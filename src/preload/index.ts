import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {
  getServices: () => ipcRenderer.invoke('get-services'),
  showService: (serviceId: string) => ipcRenderer.invoke('show-service', serviceId),
  hideService: (serviceId: string) => ipcRenderer.invoke('hide-service', serviceId),
  getActiveService: () => ipcRenderer.invoke('get-active-service'),
  openServiceDevtools: (serviceId: string) => ipcRenderer.invoke('open-service-devtools', serviceId),
  diagnoseService: (serviceId: string) => ipcRenderer.invoke('diagnose-service', serviceId),
  onServiceStateChanged: (callback: (services: unknown[]) => void) => {
    const listener = (_event: unknown, services: unknown[]) => callback(services)
    ipcRenderer.on('service-state-changed', listener)
    return () => {
      ipcRenderer.removeListener('service-state-changed', listener)
    }
  },
  // Broadcast APIs
  broadcastSend: (message: string) => ipcRenderer.invoke('broadcast-send', message),
  broadcastStream: (serviceId: string, message: string) =>
    ipcRenderer.invoke('broadcast-stream', serviceId, message),
  onBroadcastChunk: (serviceId: string, callback: (chunk: string) => void) => {
    const channel = `broadcast-chunk-${serviceId}`
    const listener = (_event: unknown, chunk: string) => callback(chunk)
    ipcRenderer.on(channel, listener)
    return () => { ipcRenderer.removeListener(channel, listener) }
  },
  onBroadcastDone: (serviceId: string, callback: (fullText: string) => void) => {
    const channel = `broadcast-done-${serviceId}`
    const listener = (_event: unknown, text: string) => callback(text)
    ipcRenderer.on(channel, listener)
    return () => { ipcRenderer.removeListener(channel, listener) }
  },
  onBroadcastError: (serviceId: string, callback: (error: string) => void) => {
    const channel = `broadcast-error-${serviceId}`
    const listener = (_event: unknown, err: string) => callback(err)
    ipcRenderer.on(channel, listener)
    return () => { ipcRenderer.removeListener(channel, listener) }
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore
  window.electron = electronAPI
  // @ts-ignore
  window.api = api
}
