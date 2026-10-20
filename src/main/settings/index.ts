import { app, ipcMain } from 'electron'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { serviceManager } from '../services'
import type { ServiceConfig } from '../services'

export interface ProxySettings {
  proxyUrl: string
  enabledServices: Record<string, boolean>
}

export interface AppSettings {
  proxy: ProxySettings
  /** User-defined services added at runtime (name + URL) */
  customServices: ServiceConfig[]
}

const DEFAULT_SETTINGS: AppSettings = {
  proxy: { proxyUrl: '', enabledServices: {} },
  customServices: []
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
      },
      customServices: Array.isArray(parsed.customServices) ? parsed.customServices : []
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(settings: AppSettings): void {
  const filePath = getSettingsPath()
  writeFileSync(filePath, JSON.stringify(settings, null, 2), 'utf-8')
}

export function getCustomServices(): ServiceConfig[] {
  return getSettings().customServices
}

/** Add a custom service, persist it, and register it with the ServiceManager. */
export function addCustomService(config: ServiceConfig): { ok: boolean; error?: string } {
  const id = config.id?.trim()
  const name = config.name?.trim()
  let url = config.url?.trim()

  if (!name || !url) {
    return { ok: false, error: 'Name and URL are required' }
  }
  // Normalize URL — prepend https:// when no scheme is provided
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`
  }
  try {
    // eslint-disable-next-line no-new
    new URL(url)
  } catch {
    return { ok: false, error: 'Invalid URL' }
  }

  const settings = getSettings()
  const finalId = id || `custom-${Date.now()}`

  if (settings.customServices.some((s) => s.id === finalId)) {
    return { ok: false, error: 'A service with this id already exists' }
  }

  const service: ServiceConfig = { id: finalId, name, url }
  settings.customServices.push(service)
  saveSettings(settings)
  serviceManager.addService(service)
  return { ok: true }
}

/** Remove a custom service by id, persist, and unregister it from the ServiceManager. */
export function removeCustomService(id: string): { ok: boolean; error?: string } {
  const settings = getSettings()
  const next = settings.customServices.filter((s) => s.id !== id)
  if (next.length === settings.customServices.length) {
    return { ok: false, error: 'Custom service not found' }
  }
  settings.customServices = next
  saveSettings(settings)
  serviceManager.removeService(id)
  return { ok: true }
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

  ipcMain.handle('add-custom-service', (_event, config: ServiceConfig) => {
    return addCustomService(config)
  })

  ipcMain.handle('remove-custom-service', (_event, id: string) => {
    return removeCustomService(id)
  })
}
