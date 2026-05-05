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
