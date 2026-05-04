import { BrowserWindow, WebContentsView, session } from 'electron'
import { join } from 'path'
import { ServiceConfig, ServiceState } from './types'
import { Bridge } from '../bridges'
import { KimiBridge } from '../bridges/kimi-bridge'
import { QwenBridge } from '../bridges/qwen-bridge'

export class ServiceManager {
  private views: Map<string, WebContentsView> = new Map()
  private configs: Map<string, ServiceConfig> = new Map()
  private states: Map<string, ServiceState> = new Map()
  private bridges: Map<string, Bridge> = new Map()
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

    const view = new WebContentsView({
      webPreferences: {
        session: ses,
        preload: join(__dirname, '../preload/bridge.js'),
        sandbox: false,
        contextIsolation: false,
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

    view.webContents.on('did-finish-load', () => {
      this.updateState(config.id, { status: 'ready' })
      // Initialize bridge after page loads
      this.initializeBridge(config.id, view)
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

  getBridge(id: string): Bridge | undefined {
    return this.bridges.get(id)
  }

  /** Reposition the service view when window resizes */
  relayout(): void {
    if (!this.activeServiceId) return
    const view = this.views.get(this.activeServiceId)
    if (view) {
      this.layoutServiceView(view)
    }
  }

  private async initializeBridge(serviceId: string, view: WebContentsView): Promise<void> {
    let bridge: Bridge | undefined

    switch (serviceId) {
      case 'kimi': {
        const kimiBridge = new KimiBridge()
        kimiBridge.setView(view)
        bridge = kimiBridge
        break
      }
      case 'qwen': {
        const qwenBridge = new QwenBridge()
        qwenBridge.setView(view)
        bridge = qwenBridge
        break
      }
      // Other bridges will be added here
    }

    if (bridge) {
      try {
        await bridge.initialize()
        this.bridges.set(serviceId, bridge)
        console.log(`[Bridge] ${serviceId} initialized successfully`)
      } catch (err) {
        console.error(`[Bridge] Failed to initialize ${serviceId}:`, err)
      }
    } else {
      console.log(`[Bridge] No bridge implementation for ${serviceId}`)
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
