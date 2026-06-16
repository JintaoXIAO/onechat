import { app, BrowserWindow, ipcMain } from "electron";
import { join } from "path";
import { is } from "@electron-toolkit/utils";
import { serviceManager, BUILTIN_SERVICES } from "./services";
import { setupSettingsIPC } from "./settings";

// Global error handlers to prevent crash dialogs on macOS
process.on("uncaughtException", (error) => {
  console.error("[Uncaught Exception]", error);
});
process.on("unhandledRejection", (reason) => {
  console.error("[Unhandled Rejection]", reason);
});

function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: "OneChat",
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      sandbox: false,
    },
    autoHideMenuBar: true,
  });

  if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }

  // Open DevTools in dev mode
  if (is.dev) {
    mainWindow.webContents.openDevTools({ mode: "detach" });
  }

  return mainWindow;
}

function setupIPC(): void {
  ipcMain.handle("get-services", () => {
    return serviceManager.getServices();
  });

  ipcMain.handle("show-service", (_event, serviceId: string) => {
    serviceManager.showService(serviceId);
    return true;
  });

  ipcMain.handle("hide-service", (_event, serviceId: string) => {
    serviceManager.hideService(serviceId);
    return true;
  });

  ipcMain.handle("get-active-service", () => {
    return serviceManager.getActiveServiceId();
  });

  // Open DevTools for a specific service view (for debugging)
  ipcMain.handle("open-service-devtools", (_event, serviceId: string) => {
    const view = serviceManager.getView(serviceId);
    if (view && !view.webContents.isDestroyed()) {
      view.webContents.openDevTools({ mode: "detach" });
      return true;
    }
    return false;
  });

  // Hard refresh a service page
  ipcMain.handle("reload-service", (_event, serviceId: string) => {
    const view = serviceManager.getView(serviceId);
    if (view && !view.webContents.isDestroyed()) {
      view.webContents.reloadIgnoringCache();
      return true;
    }
    return false;
  });
}

app.whenReady().then(() => {
  setupIPC();
  setupSettingsIPC();

  const mainWindow = createWindow();
  serviceManager.setMainWindow(mainWindow);

  // Register built-in services
  for (const config of BUILTIN_SERVICES) {
    serviceManager.addService(config);
  }

  // Handle window resize to reposition service views
  mainWindow.on("resize", () => {
    if (mainWindow.isDestroyed()) return;
    serviceManager.relayout();
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const newWindow = createWindow();
      serviceManager.setMainWindow(newWindow);
      newWindow.on("resize", () => {
        if (newWindow.isDestroyed()) return;
        serviceManager.relayout();
      });
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  serviceManager.destroyAll();
});
