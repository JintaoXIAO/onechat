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
      openServiceDevtools: (id: string) => Promise<boolean>
      diagnoseService: (id: string) => Promise<unknown>
      onServiceStateChanged: (callback: (services: ServiceState[]) => void) => () => void
      // Broadcast APIs
      broadcastSend: (message: string) => Promise<string[]>
      broadcastStream: (serviceId: string, message: string) => Promise<{ success?: boolean; error?: string }>
      onBroadcastChunk: (serviceId: string, callback: (chunk: string) => void) => () => void
      onBroadcastDone: (serviceId: string, callback: (fullText: string) => void) => () => void
      onBroadcastError: (serviceId: string, callback: (error: string) => void) => () => void
    }
  }
}
