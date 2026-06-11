# Per-Service Proxy Configuration

## Summary

Add a settings page to OneChat that allows users to configure a proxy server (HTTP or SOCKS5) and selectively enable it for specific AI services. Each service's Electron session gets its proxy configured independently via `session.setProxy()`.

## Data Model

```typescript
// Stored in {userData}/settings.json
interface ProxySettings {
  proxyUrl: string                    // e.g. "http://127.0.0.1:7890" or "socks5://127.0.0.1:1080"
  enabledServices: Record<string, boolean>  // service id → whether proxy is enabled
}

interface AppSettings {
  proxy: ProxySettings
}
```

Default when no file exists:
```json
{ "proxy": { "proxyUrl": "", "enabledServices": {} } }
```

## Persistence

Plain JSON file at `app.getPath('userData')/settings.json`. Read/write via Node `fs` (no external dependencies). Read on app startup; write on save from settings page.

## Proxy Application

- On `ServiceManager.addService()`: after creating the session partition, check settings. If the service has proxy enabled and `proxyUrl` is non-empty, call `ses.setProxy({ proxyRules: proxyUrl })`.
- On settings save: iterate all existing sessions and re-apply proxy rules. `session.setProxy()` takes effect immediately without page reload.
- If `proxyUrl` is empty or service is not enabled: call `ses.setProxy({ proxyRules: '' })` (direct connection).

## IPC Interface

| Channel | Direction | Payload | Response |
|---------|-----------|---------|----------|
| `get-settings` | renderer → main | — | `AppSettings` |
| `save-settings` | renderer → main | `AppSettings` | `boolean` (success) |

## Frontend

### Entry Point

Sidebar bottom: a gear icon (⚙️) button. Clicking it:
1. Hides the active service view (if any)
2. Shows the settings page in the main content area

### Settings Page (`src/renderer/src/components/SettingsPage.tsx`)

Layout:
- Section header: "Proxy Settings"
- Input field: proxy URL (placeholder: `http://127.0.0.1:7890 or socks5://127.0.0.1:1080`)
- Service list: each service displayed with name + toggle switch ("Use Proxy")
- Save button at bottom
- Visual feedback on save (brief success message or button state change)

Clicking a service icon in the sidebar while settings is open navigates back to service view.

## File Changes

### New Files
- `src/main/settings/index.ts` — read/write settings.json, register IPC handlers, export `getSettings()`
- `src/renderer/src/components/SettingsPage.tsx` — settings UI

### Modified Files
- `src/main/index.ts` — import and call settings IPC registration
- `src/main/services/service-manager.ts` — `applyProxy(serviceId)` method, call it in `addService()` and expose for settings module
- `src/preload/index.ts` — expose `getSettings()` and `saveSettings()` on `window.api`
- `src/renderer/src/types.ts` — add `AppSettings`, `ProxySettings` types and update `Window.api`
- `src/renderer/src/App.tsx` — manage `activeView` state ('service' | 'settings'), render SettingsPage
- `src/renderer/src/components/Sidebar.tsx` — add gear button at bottom

## Non-Goals

- Proxy authentication (username/password) — can be added later if needed
- Per-service different proxy URLs — single global proxy URL with per-service on/off is sufficient
- Connectivity test button — YAGNI for now
