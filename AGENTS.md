# AGENTS.md — OneChat

## What is this

AI chat aggregator built on Electron. Loads AI web services (Kimi, Qwen, ChatGPT, etc.) in hidden BrowserViews, injects bridge scripts to control them, and exposes a local OpenAI-compatible HTTP API so other tools can use these services programmatically.

## Tech stack

- **Runtime**: Electron (main + renderer + preload)
- **Build**: electron-vite 3.x (Vite 6 under the hood)
- **Package manager**: Bun (via scoop, no Node.js installed separately — Electron ships its own Node)
- **UI**: React 19 + Tailwind CSS 4 (using `@tailwindcss/vite` plugin, CSS-first config via `@import "tailwindcss"`)
- **API server**: Fastify (runs inside Electron main process)
- **Language**: TypeScript (strict mode)

## Project layout

```
src/
  main/           # Electron main process (entry: index.ts)
    api-server/   # Fastify local HTTP server (OpenAI-compatible endpoints)
    bridges/      # Per-service bridge implementations
  preload/        # Preload scripts (index.ts for UI, bridge.ts for AI webviews)
  renderer/       # React UI (entry: src/main.tsx, root: index.html)
out/              # Build output (gitignored)
```

## Commands

| Task | Command |
|------|---------|
| Dev (hot reload) | `bun run dev` |
| Production build | `bun run build` |
| Type check | `bun run typecheck` |
| Preview built app | `bun run preview` |

All commands use `bun run`. Do NOT use `npm` or `npx` — Node.js is not installed on this machine.

## Architecture notes

1. **Three processes**: main (Node/Electron), preload (bridge between), renderer (React UI).
2. **BrowserViews**: Each AI service runs in a hidden `BrowserView` with a service-specific preload script injected. The bridge communicates via Electron IPC.
3. **Bridge pattern**: Each AI service gets a bridge class (`src/main/bridges/`) implementing a common interface: `sendMessage(text) → AsyncIterable<string>`. Two strategies: DOM manipulation or network interception.
4. **API Server**: Fastify on `localhost:11434` (Ollama-style port), exposes `/v1/chat/completions` and `/v1/models`. Runs in the main process.
5. **IPC flow**: API Server → ServiceManager → Bridge → BrowserView (preload script) → AI webpage DOM/network.

## Conventions

- Tailwind 4 CSS-first approach: no `tailwind.config.js`; configure via CSS `@theme` directives in `src/renderer/src/index.css`
- electron-vite uses three separate Vite configs (main, preload, renderer) defined in `electron.vite.config.ts`
- TypeScript has two project references: `tsconfig.node.json` (main + preload) and `tsconfig.web.json` (renderer)
- Commits should be granular — one feature or fix per commit

## Gotchas

- **Electron binary**: Bun does not auto-run postinstall scripts by default. Electron is listed in `trustedDependencies` in package.json so `bun install` downloads the binary. If `electron/dist/electron.exe` is missing, run: `$env:ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"; bun run node_modules/electron/install.js`
- `bun run typecheck` uses the composite TS setup — `tsc --noEmit` must be run from root
- Renderer code lives at `src/renderer/src/` (note the nested `src/`), HTML entry is at `src/renderer/index.html`
- Electron is a devDependency but ships its own Node.js runtime — build artifacts in `out/` use Electron's Node
- The `@electron-toolkit/utils` export `is.dev` checks `ELECTRON_RENDERER_URL` env var set by electron-vite in dev mode
