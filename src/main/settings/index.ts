import { app, ipcMain } from 'electron'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { serviceManager } from '../services'

export interface ProxySettings {
  proxyUrl: string
  enabledServices: Record<string, boolean>
}

export interface AppSettings {
  proxy: ProxySettings
}

const DEFAULT_SETTINGS: AppSettings = {
  proxy: { proxyUrl: '', enabledServices: {} }
}

function getSettingsPath(): string {
  return join(app.getPath('userData'), 'settings.json')
}

export function getSettings(): AppSettings {
  const filePath = getSettingsPath()
  if (!existsSync(filePath)) return DEFAULT_SETTINGS
  try {
    const raw = readFileSync(filePath, 'utf-8')
    const parsed = JSON.parse(raw)
    return {
      proxy: {
        ...DEFAULT_SETTINGS.proxy,
        ...parsed.proxy
      }
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(settings: AppSettings): void {
  const filePath = getSettingsPath()
  writeFileSync(filePath, JSON.stringify(settings, null, 2), 'utf-8')
}

export function setupSettingsIPC(): void {
  ipcMain.handle('get-settings', () => {
    return getSettings()
  })

  ipcMain.handle('save-settings', (_event, settings: AppSettings) => {
    saveSettings(settings)
    // Re-apply proxy to all services
    serviceManager.applyAllProxies()
    return true
  })
}
