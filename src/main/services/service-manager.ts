import { BrowserWindow, WebContentsView, session, shell } from 'electron'
import { ServiceConfig, ServiceState } from './types'
import { getSettings } from '../settings'

/** Time in ms before an inactive service view gets destroyed (10 minutes) */
const SLEEP_TIMEOUT_MS = 10 * 60 * 1000

export class ServiceManager {
  private views: Map<string, WebContentsView> = new Map()
  private configs: Map<string, ServiceConfig> = new Map()
  private states: Map<string, ServiceState> = new Map()
  private sessions: Map<string, Electron.Session> = new Map()
  private sleepTimers: Map<string, NodeJS.Timeout> = new Map()
  private mainWindow: BrowserWindow | null = null
  private activeServiceId: string | null = null

  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window
  }

  /** Register a service config (lazy — does NOT create a view yet) */
  addService(config: ServiceConfig): void {
    if (this.configs.has(config.id)) return
    this.configs.set(config.id, config)

    // Set initial idle state
    this.states.set(config.id, {
      id: config.id,
      name: config.name,
      url: config.url,
      status: 'idle',
      visible: false
    })

    this.notifyRenderer()
  }

  removeService(id: string): void {
    this.cancelSleepTimer(id)
    this.destroyView(id)
    this.configs.delete(id)
    this.states.delete(id)
    this.sessions.delete(id)

    if (this.activeServiceId === id) {
      this.activeServiceId = null
    }
    this.notifyRenderer()
  }

  showService(id: string): void {
    if (!this.mainWindow) return

    // Hide current active service
    if (this.activeServiceId && this.activeServiceId !== id) {
      this.hideService(this.activeServiceId)
    }

    // Cancel sleep timer if pending
    this.cancelSleepTimer(id)

    // If view doesn't exist, create it (lazy activation)
    if (!this.views.has(id)) {
      this.activateService(id)
      // activateService handles adding to window after load
      this.activeServiceId = id
      return
    }

    const view = this.views.get(id)!
    this.mainWindow.contentView.addChildView(view)
    this.layoutServiceView(view)
    this.activeServiceId = id
    this.updateState(id, { visible: true })
  }

  hideService(id: string): void {
    if (!this.mainWindow) return

    const view = this.views.get(id)
    if (view) {
      this.mainWindow.contentView.removeChildView(view)
    }
    this.updateState(id, { visible: false })

    if (this.activeServiceId === id) {
      this.activeServiceId = null
    }

    // Start sleep timer
    this.startSleepTimer(id)
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
    const enabled = settings.proxy?.enabledServices?.[serviceId] ?? false
    const proxyUrl = settings.proxy?.proxyUrl
    if (enabled && proxyUrl) {
      ses.setProxy({ proxyRules: proxyUrl }).catch(() => {})
    } else {
      ses.setProxy({ proxyRules: '' }).catch(() => {})
    }
  }

  applyAllProxies(): void {
    for (const id of this.sessions.keys()) {
      this.applyProxy(id)
    }
  }

  // --- Private methods ---

  /** Create the view and load the page (lazy activation) */
  private activateService(id: string): void {
    const config = this.configs.get(id)
    if (!config || !this.mainWindow) return

    // Create or retrieve persistent session
    let ses = this.sessions.get(id)
    if (!ses) {
      const partition = `persist:service-${id}`
      ses = session.fromPartition(partition)
      this.sessions.set(id, ses)
      this.applyProxy(id)
    }

    const view = new WebContentsView({
      webPreferences: {
        session: ses,
        sandbox: false,
        contextIsolation: true,
        nodeIntegration: false
      }
    })

    this.updateState(id, { status: 'loading', visible: true })

    // Set user agent if configured
    if (config.userAgent) {
      view.webContents.setUserAgent(config.userAgent)
    }

    view.webContents.loadURL(config.url).catch(() => {
      // Handled by did-fail-load event
    })

    // Handle popup windows (e.g. Google OAuth login)
    view.webContents.setWindowOpenHandler(({ url }) => {
      if (this.isAuthUrl(url)) {
        this.openAuthWindow(url, ses!)
        return { action: 'deny' }
      }
      shell.openExternal(url)
      return { action: 'deny' }
    })

    view.webContents.on('did-finish-load', () => {
      this.updateState(id, { status: 'ready' })
      if (config.zoomFactor && config.zoomFactor !== 1.0) {
        view.webContents.setZoomFactor(config.zoomFactor)
      }
    })

    view.webContents.on('did-fail-load', () => {
      this.updateState(id, { status: 'error' })
    })

    this.views.set(id, view)

    // Add to window immediately and position
    this.mainWindow.contentView.addChildView(view)
    this.layoutServiceView(view)
  }

  /** Destroy a view and release memory */
  private destroyView(id: string): void {
    const view = this.views.get(id)
    if (!view) return

    if (this.mainWindow) {
      this.mainWindow.contentView.removeChildView(view)
    }
    view.webContents.close()
    this.views.delete(id)
  }

  /** Start a timer to put a service to sleep after SLEEP_TIMEOUT_MS */
  private startSleepTimer(id: string): void {
    this.cancelSleepTimer(id)
    const timer = setTimeout(() => {
      this.sleepTimers.delete(id)
      // Only sleep if still not active
      if (this.activeServiceId !== id) {
        this.destroyView(id)
        this.updateState(id, { status: 'idle' })
        console.log(`[Sleep] ${id} view destroyed after inactivity`)
      }
    }, SLEEP_TIMEOUT_MS)
    this.sleepTimers.set(id, timer)
  }

  /** Cancel a pending sleep timer */
  private cancelSleepTimer(id: string): void {
    const timer = this.sleepTimers.get(id)
    if (timer) {
      clearTimeout(timer)
      this.sleepTimers.delete(id)
    }
  }

  private layoutServiceView(view: WebContentsView): void {
    if (!this.mainWindow) return
    const bounds = this.mainWindow.getContentBounds()
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

    authWindow.webContents.on('will-redirect', (details) => {
      const redirectUrl = details.url
      if (!this.isAuthUrl(redirectUrl) && !redirectUrl.includes('accounts.google.com')) {
        setTimeout(() => {
          if (!authWindow.isDestroyed()) authWindow.close()
        }, 1000)
      }
    })

    // Clean up auth window reference when user closes it manually
    authWindow.on('closed', () => {
      // Window is already destroyed, nothing to clean up
    })
  }

  private updateState(id: string, partial: Partial<ServiceState>): void {
    const state = this.states.get(id)
    if (state) {
      Object.assign(state, partial)
      this.notifyRenderer()
    }
  }

  private notifyRenderer(): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('service-state-changed', this.getServices())
    }
  }
}

// Singleton
export const serviceManager = new ServiceManager()
