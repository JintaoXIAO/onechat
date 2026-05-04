export interface ServiceState {
  id: string
  name: string
  url: string
  status: 'loading' | 'ready' | 'error'
  visible: boolean
}

declare global {
  interface Window {
    api: {
      getServices: () => Promise<ServiceState[]>
      showService: (id: string) => Promise<boolean>
      hideService: (id: string) => Promise<boolean>
      getActiveService: () => Promise<string | null>
      onServiceStateChanged: (callback: (services: ServiceState[]) => void) => () => void
    }
  }
}
