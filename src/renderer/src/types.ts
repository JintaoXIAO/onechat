export interface ServiceState {
  id: string
  name: string
  url: string
  status: 'idle' | 'loading' | 'ready' | 'error'
  visible: boolean
}

export interface ServiceConfig {
  id: string
  name: string
  url: string
  zoomFactor?: number
  userAgent?: string
}

export interface ProxySettings {
  proxyUrl: string
  enabledServices: Record<string, boolean>
}

export interface AppSettings {
  proxy: ProxySettings
  customServices: ServiceConfig[]
}

export interface CustomServiceResult {
  ok: boolean
  error?: string
}

declare global {
  interface Window {
    api: {
      getServices: () => Promise<ServiceState[]>
      showService: (id: string) => Promise<boolean>
      hideService: (id: string) => Promise<boolean>
      reloadService: (id: string) => Promise<boolean>
      getActiveService: () => Promise<string | null>
      getSettings: () => Promise<AppSettings>
      saveSettings: (settings: AppSettings) => Promise<boolean>
      addCustomService: (config: {
        id?: string
        name: string
        url: string
      }) => Promise<CustomServiceResult>
      removeCustomService: (id: string) => Promise<CustomServiceResult>
      onServiceStateChanged: (callback: (services: ServiceState[]) => void) => () => void
    }
  }
}
