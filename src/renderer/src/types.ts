export interface ServiceState {
  id: string
  name: string
  url: string
  status: 'idle' | 'loading' | 'ready' | 'error'
  visible: boolean
}

export interface ProxySettings {
  proxyUrl: string
  enabledServices: Record<string, boolean>
}

export interface AppSettings {
  proxy: ProxySettings
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
      onServiceStateChanged: (callback: (services: ServiceState[]) => void) => () => void
    }
  }
}
