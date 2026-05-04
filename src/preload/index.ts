import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {
  // Will be expanded with Bridge communication methods
  getServices: () => ipcRenderer.invoke('get-services'),
  sendMessage: (serviceId: string, message: string) =>
    ipcRenderer.invoke('send-message', serviceId, message)
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
