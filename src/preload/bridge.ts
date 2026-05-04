/**
 * Preload script for AI service BrowserViews.
 * Exposes ipcRenderer so the injected bridge scripts can communicate
 * back to the main process.
 *
 * NOTE: contextIsolation is true, but we expose via contextBridge.
 * The bridge injection script running via executeJavaScript has access
 * to the isolated world, so we use a different approach:
 * We disable contextIsolation for service views and expose require directly.
 */

// For service views, we allow require('electron') in injected scripts
// by setting contextIsolation: false and nodeIntegration: true in the view.
// This preload simply ensures the environment is set up.

import { ipcRenderer } from 'electron'

// Make ipcRenderer available on window for injected scripts
;(window as any).ipcRenderer = ipcRenderer
