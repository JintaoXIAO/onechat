import { app, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { serviceManager, BUILTIN_SERVICES } from './services'
import { startApiServer } from './api-server'

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

  // Open DevTools in dev mode
  if (is.dev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' })
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

  // Open DevTools for a specific service view (for debugging)
  ipcMain.handle('open-service-devtools', (_event, serviceId: string) => {
    const view = serviceManager.getView(serviceId)
    if (view) {
      view.webContents.openDevTools({ mode: 'detach' })
      return true
    }
    return false
  })

  // Diagnose: inspect the DOM of a service view
  ipcMain.handle('diagnose-service', async (_event, serviceId: string) => {
    const view = serviceManager.getView(serviceId)
    if (!view) return { error: 'View not found' }

    const result = await view.webContents.executeJavaScript(`
      (() => {
        const textareas = [...document.querySelectorAll('textarea')].map(el => ({
          tag: 'textarea',
          className: el.className.slice(0, 100),
          placeholder: el.placeholder,
          id: el.id
        }));
        const editables = [...document.querySelectorAll('[contenteditable="true"]')].map(el => ({
          tag: el.tagName,
          className: el.className.slice(0, 100),
          id: el.id
        }));
        const buttons = [...document.querySelectorAll('button')].slice(0, 20).map(el => ({
          tag: 'button',
          className: el.className.slice(0, 100),
          text: el.textContent?.trim().slice(0, 50),
          disabled: el.disabled
        }));
        const editors = [...document.querySelectorAll('[class*="editor"]')].map(el => ({
          tag: el.tagName,
          className: el.className.slice(0, 100)
        }));

        // Find message/response containers
        const messageContainers = [
          ...[...document.querySelectorAll('[class*="message"]')].slice(0, 10),
          ...[...document.querySelectorAll('[class*="segment"]')].slice(0, 5),
          ...[...document.querySelectorAll('[class*="chat"]')].slice(0, 10),
          ...[...document.querySelectorAll('[class*="conversation"]')].slice(0, 5),
          ...[...document.querySelectorAll('[class*="response"]')].slice(0, 5),
          ...[...document.querySelectorAll('[class*="answer"]')].slice(0, 5)
        ].map(el => ({
          tag: el.tagName,
          className: el.className?.slice?.(0, 150) || '',
          childCount: el.children.length,
          textPreview: (el.innerText || '').slice(0, 80)
        }));

        return { textareas, editables, buttons, editors, messageContainers, url: location.href };
      })()
    `)
    return result
  })

  // Broadcast: send a message to all ready bridges
  ipcMain.handle('broadcast-send', async (event, message: string) => {
    const services = serviceManager.getServices()
    const readyServices = services.filter((s) => {
      const bridge = serviceManager.getBridge(s.id)
      return bridge && bridge.isReady()
    })

    // Return the list of services that will receive the message
    return readyServices.map((s) => s.id)
  })

  // Broadcast: start streaming from a specific service
  ipcMain.handle('broadcast-stream', async (event, serviceId: string, message: string) => {
    const bridge = serviceManager.getBridge(serviceId)
    if (!bridge || !bridge.isReady()) {
      return { error: `Service ${serviceId} not ready` }
    }

    const messages = [{ role: 'user' as const, content: message }]

    try {
      let fullText = ''
      for await (const chunk of bridge.sendMessage(messages)) {
        fullText += chunk
        // Send chunks back to renderer as they arrive
        if (!event.sender.isDestroyed()) {
          event.sender.send(`broadcast-chunk-${serviceId}`, chunk)
        }
      }
      if (!event.sender.isDestroyed()) {
        event.sender.send(`broadcast-done-${serviceId}`, fullText)
      }
      return { success: true, text: fullText }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error'
      if (!event.sender.isDestroyed()) {
        event.sender.send(`broadcast-error-${serviceId}`, errMsg)
      }
      return { error: errMsg }
    }
  })
}

app.whenReady().then(async () => {
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

  // Start the API server
  try {
    await startApiServer()
  } catch (err) {
    console.error('Failed to start API server:', err)
  }

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
