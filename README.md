# OneChat

All your AI chats in one window. OneChat is a lightweight Electron desktop app that aggregates multiple AI services — switch between them with a single click, no browser tabs required.

## Built-in Services

| Service | URL |
|---------|-----|
| Kimi | kimi.moonshot.cn |
| 通义千问 (Qwen) | tongyi.aliyun.com/qianwen |
| DeepSeek | chat.deepseek.com |
| ChatGLM | chatglm.cn |
| ChatGPT | chatgpt.com |
| Claude | claude.ai |
| Grok | grok.com |
| 金山词霸 | iciba.com |

## Features

- **Sidebar switching** — Click service icons to instantly switch between AI chats
- **Per-service proxy** — Configure HTTP/SOCKS5 proxy and enable it selectively (e.g. only for ChatGPT/Claude)
- **Lazy loading** — Services only load when first clicked, keeping startup fast and memory low
- **Auto sleep** — Inactive services are destroyed after 10 minutes to free memory; cookies persist across sleep
- **OAuth support** — Google/Apple/Microsoft login popups work correctly with shared session
- **Hard refresh** — Click the active service icon again to reload the page

## Prerequisites

- [Bun](https://bun.sh/) (package manager & script runner)
- Git

> **Note:** Node.js is NOT required — Electron ships its own runtime.

## Install

```bash
git clone https://github.com/JintaoXIAO/onechat.git
cd onechat
bun install
```

If the Electron binary fails to download, set a mirror:

```bash
# PowerShell
$env:ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
bun run node_modules/electron/install.js
```

## Development

```bash
bun run dev
```

Opens the app with hot reload for renderer changes.

## Build

### Production build (compile only)

```bash
bun run build
```

Output in `out/` (main + preload + renderer bundles).

### Package (unpacked directory)

```bash
bun run pack
```

Output in `release/win-unpacked/` (or platform equivalent).

### Distribute (installer)

```bash
# All platforms (current OS)
bun run dist

# Platform-specific
bun run dist:win     # Windows — NSIS installer
bun run dist:mac     # macOS — DMG + ZIP
bun run dist:linux   # Linux — AppImage + DEB
```

Output in `release/`.

> **Windows note:** If `electron-builder` fails to download `winCodeSign`, set the mirror:
> ```powershell
> $env:ELECTRON_BUILDER_BINARIES_MIRROR="https://npmmirror.com/mirrors/electron-builder-binaries/"
> bun run dist
> ```

## Other Commands

| Command | Description |
|---------|-------------|
| `bun run typecheck` | TypeScript type checking |
| `bun run lint` | ESLint |

## Tech Stack

- **Runtime:** Electron 35
- **Build:** electron-vite (Vite 6)
- **UI:** React 19 + Tailwind CSS 4
- **Language:** TypeScript (strict)
- **Package Manager:** Bun

## Project Structure

```
src/
  main/              # Electron main process
    services/        # ServiceManager (lazy load, sleep, proxy)
    settings/        # Persistent settings (JSON in userData)
  preload/           # Preload script (IPC bridge to renderer)
  renderer/          # React UI
    src/
      components/    # Sidebar, SettingsPage, WelcomeScreen
      assets/icons/  # Service icons (PNG/SVG)
```

## License

MIT
