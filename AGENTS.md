# AGENTS.md — OneChat

## What is this

AI chat aggregator built on Electron. Loads AI web services (Kimi, Qwen, DeepSeek, ChatGLM, ChatGPT, Claude, Grok, etc.) in WebContentsViews, providing a unified window with per-service session isolation and lazy loading.

## Tech stack

- **Runtime**: Electron 35 (main + renderer + preload)
- **Build**: electron-vite 3.x (Vite 6 under the hood)
- **Package manager**: Bun (via scoop, no Node.js installed separately — Electron ships its own Node)
- **UI**: React 19 + Tailwind CSS 4 (using `@tailwindcss/vite` plugin, CSS-first config via `@import "tailwindcss"`)
- **Language**: TypeScript (strict mode)

## Project layout

```
src/
  main/           # Electron main process (entry: index.ts)
    services/     # ServiceManager + service config/state types
    settings/     # App settings (proxy config) with JSON persistence
  preload/        # Preload script (index.ts — exposes IPC API to renderer)
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
2. **WebContentsView**: Each AI service runs in a `WebContentsView` attached to the main window's `contentView`. Views are lazily created on first show and destroyed after 10 min of inactivity (sleep). The currently active (foreground) service is never destroyed.
3. **Session isolation**: Each service gets its own `persist:service-{id}` partition, preserving login cookies across restarts.
4. **IPC flow**: Renderer → preload (`window.api.*`) → ipcMain handlers → ServiceManager.
5. **Proxy support**: Per-service proxy toggle with a shared proxy URL, applied via `session.setProxy()`.

## Conventions

- Tailwind 4 CSS-first approach: no `tailwind.config.js`; configure via CSS `@theme` directives in `src/renderer/src/index.css`
- electron-vite uses three separate Vite configs (main, preload, renderer) defined in `electron.vite.config.ts`
- TypeScript has two project references: `tsconfig.node.json` (main + preload) and `tsconfig.web.json` (renderer)
- Commits should be granular — one feature or fix per commit
- Sidebar width is `w-14` (56px) in renderer, mirrored as `SIDEBAR_WIDTH_PX` constant in ServiceManager

## Gotchas

- **Electron binary**: Bun does not auto-run postinstall scripts by default. Electron is listed in `trustedDependencies` in package.json so `bun install` downloads the binary. If `electron/dist/electron.exe` is missing, run: `$env:ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"; bun run node_modules/electron/install.js`
- `bun run typecheck` uses the composite TS setup — `tsc --noEmit` must be run from root
- Renderer code lives at `src/renderer/src/` (note the nested `src/`), HTML entry is at `src/renderer/index.html`
- Electron is a devDependency but ships its own Node.js runtime — build artifacts in `out/` use Electron's Node
- The `@electron-toolkit/utils` export `is.dev` checks `ELECTRON_RENDERER_URL` env var set by electron-vite in dev mode
- **macOS lifecycle**: Window close (⌘W) destroys the BrowserWindow but keeps the app alive. ServiceManager nulls its `mainWindow` ref and cancels all sleep timers on `closed`. `app.on('activate')` recreates the window.
- **backgroundThrottling: false**: Service views disable background throttling to prevent Electron from destroying webContents while the window is minimized.
