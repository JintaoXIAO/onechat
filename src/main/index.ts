import { app, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { serviceManager, BUILTIN_SERVICES } from './services'

function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'OneChat',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

function setupIPC(): void {
  ipcMain.handle('get-services', () => {
    return serviceManager.getServices()
  })

  ipcMain.handle('show-service', (_event, serviceId: string) => {
    serviceManager.showService(serviceId)
    return true
  })

  ipcMain.handle('hide-service', (_event, serviceId: string) => {
    serviceManager.hideService(serviceId)
    return true
  })

  ipcMain.handle('get-active-service', () => {
    return serviceManager.getActiveServiceId()
  })
}

app.whenReady().then(() => {
  setupIPC()

  const mainWindow = createWindow()
  serviceManager.setMainWindow(mainWindow)

  // Register built-in services
  for (const config of BUILTIN_SERVICES) {
    serviceManager.addService(config)
  }

  // Handle window resize to reposition service views
  mainWindow.on('resize', () => {
    serviceManager.relayout()
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
