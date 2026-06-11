import { BrowserWindow, WebContentsView, session, shell } from 'electron'
import { ServiceConfig, ServiceState } from './types'
import { getSettings } from '../settings'

export class ServiceManager {
  private views: Map<string, WebContentsView> = new Map()
  private configs: Map<string, ServiceConfig> = new Map()
  private states: Map<string, ServiceState> = new Map()
  private sessions: Map<string, Electron.Session> = new Map()
  private mainWindow: BrowserWindow | null = null
  private activeServiceId: string | null = null

  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window
  }

  addService(config: ServiceConfig): void {
    if (this.views.has(config.id)) return
    this.configs.set(config.id, config)

    // Use a persistent session partition per service to isolate cookies
    const partition = `persist:service-${config.id}`
    const ses = session.fromPartition(partition)
    this.sessions.set(config.id, ses)
    this.applyProxy(config.id)

    const view = new WebContentsView({
      webPreferences: {
        session: ses,
        sandbox: false,
        contextIsolation: true,
        nodeIntegration: false
      }
    })

    // Set initial state
    this.states.set(config.id, {
      id: config.id,
      name: config.name,
      url: config.url,
      status: 'loading',
      visible: false
    })

    // Load the service URL
    view.webContents.loadURL(config.url)

    // Handle popup windows (e.g. Google OAuth login)
    view.webContents.setWindowOpenHandler(({ url }) => {
      // Open OAuth/login popups in a new window sharing the same session
      if (this.isAuthUrl(url)) {
        this.openAuthWindow(url, ses)
        return { action: 'deny' }
      }
      // Open other external links in the system browser
      shell.openExternal(url)
      return { action: 'deny' }
    })

    view.webContents.on('did-finish-load', () => {
      this.updateState(config.id, { status: 'ready' })
    })

    view.webContents.on('did-fail-load', () => {
      this.updateState(config.id, { status: 'error' })
    })

    this.views.set(config.id, view)
  }

  removeService(id: string): void {
    const view = this.views.get(id)
    if (!view) return

    if (this.mainWindow) {
      this.mainWindow.contentView.removeChildView(view)
    }
    view.webContents.close()
    this.views.delete(id)
    this.configs.delete(id)
    this.states.delete(id)

    if (this.activeServiceId === id) {
      this.activeServiceId = null
    }
  }

  showService(id: string): void {
    if (!this.mainWindow) return

    // Hide current active service
    if (this.activeServiceId && this.activeServiceId !== id) {
      this.hideService(this.activeServiceId)
    }

    const view = this.views.get(id)
    if (!view) return

    // Add view to window and position it
    this.mainWindow.contentView.addChildView(view)
    this.layoutServiceView(view)
    this.activeServiceId = id
    this.updateState(id, { visible: true })
  }

  hideService(id: string): void {
    if (!this.mainWindow) return

    const view = this.views.get(id)
    if (!view) return

    this.mainWindow.contentView.removeChildView(view)
    this.updateState(id, { visible: false })

    if (this.activeServiceId === id) {
      this.activeServiceId = null
    }
  }

  getServices(): ServiceState[] {
    return Array.from(this.states.values())
  }

  getActiveServiceId(): string | null {
    return this.activeServiceId
  }

  getView(id: string): WebContentsView | undefined {
    return this.views.get(id)
  }

  /** Reposition the service view when window resizes */
  relayout(): void {
    if (!this.activeServiceId) return
    const view = this.views.get(this.activeServiceId)
    if (view) {
      this.layoutServiceView(view)
    }
  }

  applyProxy(serviceId: string): void {
    const ses = this.sessions.get(serviceId)
    if (!ses) return
    const settings = getSettings()
    const enabled = settings.proxy.enabledServices[serviceId] ?? false
    const proxyUrl = settings.proxy.proxyUrl
    if (enabled && proxyUrl) {
      ses.setProxy({ proxyRules: proxyUrl })
    } else {
      ses.setProxy({ proxyRules: '' })
    }
  }

  applyAllProxies(): void {
    for (const id of this.sessions.keys()) {
      this.applyProxy(id)
    }
  }

  private layoutServiceView(view: WebContentsView): void {
    if (!this.mainWindow) return
    const bounds = this.mainWindow.getContentBounds()
    // Leave space for the narrow icon sidebar (56px = w-14 in Tailwind)
    const sidebarWidth = 56
    view.setBounds({
      x: sidebarWidth,
      y: 0,
      width: bounds.width - sidebarWidth,
      height: bounds.height
    })
  }

  private isAuthUrl(url: string): boolean {
    const authDomains = [
      'accounts.google.com',
      'appleid.apple.com',
      'login.microsoftonline.com',
      'github.com/login',
      'auth0.com'
    ]
    return authDomains.some((domain) => url.includes(domain))
  }

  private openAuthWindow(url: string, ses: Electron.Session): void {
    const authWindow = new BrowserWindow({
      width: 500,
      height: 700,
      parent: this.mainWindow ?? undefined,
      modal: false,
      webPreferences: {
        session: ses,
        nodeIntegration: false,
        contextIsolation: true
      }
    })

    authWindow.loadURL(url)

    // Close auth window when navigation returns to the service
    authWindow.webContents.on('will-redirect', (_event, redirectUrl) => {
      if (!this.isAuthUrl(redirectUrl) && !redirectUrl.includes('accounts.google.com')) {
        // Auth flow completed, close after a short delay to let cookies settle
        setTimeout(() => {
          if (!authWindow.isDestroyed()) authWindow.close()
        }, 1000)
      }
    })
  }

  private updateState(id: string, partial: Partial<ServiceState>): void {
    const state = this.states.get(id)
    if (state) {
      Object.assign(state, partial)
      // Notify renderer about state change
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('service-state-changed', this.getServices())
      }
    }
  }
}

// Singleton
export const serviceManager = new ServiceManager()
