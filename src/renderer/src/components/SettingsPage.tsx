import { useEffect, useState } from 'react'
import { AppSettings, ServiceState } from '../types'

interface SettingsPageProps {
  services: ServiceState[]
}

export function SettingsPage({ services }: SettingsPageProps) {
  const [settings, setSettings] = useState<AppSettings>({
    proxy: { proxyUrl: '', enabledServices: {} }
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    window.api.getSettings().then(setSettings)
  }, [])

  const handleProxyUrlChange = (value: string) => {
    setSettings((prev) => ({
      ...prev,
      proxy: { ...prev.proxy, proxyUrl: value }
    }))
    setSaved(false)
  }

  const handleToggleService = (serviceId: string) => {
    setSettings((prev) => ({
      ...prev,
      proxy: {
        ...prev.proxy,
        enabledServices: {
          ...prev.proxy.enabledServices,
          [serviceId]: !prev.proxy.enabledServices[serviceId]
        }
      }
    }))
    setSaved(false)
  }

  const handleSave = async () => {
    setSaving(true)
    await window.api.saveSettings(settings)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <main className="flex-1 flex items-start justify-center bg-gray-900 overflow-y-auto p-8">
      <div className="w-full max-w-lg">
        <h1 className="text-xl font-semibold text-gray-100 mb-6">Settings</h1>

        {/* Proxy URL */}
        <section className="mb-6">
          <h2 className="text-sm font-medium text-gray-300 mb-2">Proxy Server</h2>
          <input
            type="text"
            value={settings.proxy.proxyUrl}
            onChange={(e) => handleProxyUrlChange(e.target.value)}
            placeholder="http://127.0.0.1:7890 or socks5://127.0.0.1:1080"
            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </section>

        {/* Per-service toggles */}
        <section className="mb-6">
          <h2 className="text-sm font-medium text-gray-300 mb-3">Use Proxy For</h2>
          <div className="space-y-2">
            {services.map((service) => (
              <label
                key={service.id}
                className="flex items-center justify-between bg-gray-800 rounded-lg px-4 py-3 cursor-pointer hover:bg-gray-750"
              >
                <span className="text-sm text-gray-200">{service.name}</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={!!settings.proxy.enabledServices[service.id]}
                  onClick={() => handleToggleService(service.id)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                    settings.proxy.enabledServices[service.id]
                      ? 'bg-blue-600'
                      : 'bg-gray-600'
                  }`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                      settings.proxy.enabledServices[service.id]
                        ? 'translate-x-4.5'
                        : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </label>
            ))}
          </div>
        </section>

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-lg px-4 py-2 text-sm transition-colors"
        >
          {saving ? 'Saving...' : saved ? '\u2713 Saved' : 'Save'}
        </button>
      </div>
    </main>
  )
}
