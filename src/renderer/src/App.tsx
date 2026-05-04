import { useEffect, useState } from 'react'

interface ServiceState {
  id: string
  name: string
  url: string
  status: 'loading' | 'ready' | 'error'
  visible: boolean
}

declare global {
  interface Window {
    api: {
      getServices: () => Promise<ServiceState[]>
      showService: (id: string) => Promise<boolean>
      hideService: (id: string) => Promise<boolean>
      getActiveService: () => Promise<string | null>
      onServiceStateChanged: (callback: (services: ServiceState[]) => void) => () => void
    }
  }
}

function App(): React.ReactElement {
  const [services, setServices] = useState<ServiceState[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)

  useEffect(() => {
    // Load initial services
    window.api.getServices().then(setServices)
    window.api.getActiveService().then(setActiveId)

    // Listen for state changes
    const unsubscribe = window.api.onServiceStateChanged((updated) => {
      setServices(updated as ServiceState[])
      const active = (updated as ServiceState[]).find((s) => s.visible)
      setActiveId(active?.id ?? null)
    })

    return unsubscribe
  }, [])

  const handleServiceClick = async (id: string) => {
    if (activeId === id) {
      // Toggle off
      await window.api.hideService(id)
      setActiveId(null)
    } else {
      await window.api.showService(id)
      setActiveId(id)
    }
  }

  const statusColor = (status: ServiceState['status']) => {
    switch (status) {
      case 'ready':
        return 'bg-green-400'
      case 'loading':
        return 'bg-yellow-400'
      case 'error':
        return 'bg-red-400'
    }
  }

  return (
    <div className="flex h-screen bg-gray-900 text-white">
      <aside className="w-64 bg-gray-800 border-r border-gray-700 flex flex-col">
        <div className="p-4 border-b border-gray-700">
          <h1 className="text-xl font-bold">OneChat</h1>
          <p className="text-gray-400 text-xs mt-1">AI Service Aggregator</p>
        </div>

        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {services.map((service) => (
            <button
              key={service.id}
              onClick={() => handleServiceClick(service.id)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                activeId === service.id
                  ? 'bg-blue-600 text-white'
                  : 'hover:bg-gray-700 text-gray-300'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full flex-shrink-0 ${statusColor(service.status)}`}
              />
              <span className="truncate">{service.name}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-700 text-xs text-gray-500">
          {services.filter((s) => s.status === 'ready').length}/{services.length} services ready
        </div>
      </aside>

      {!activeId && (
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center text-gray-500">
            <h2 className="text-2xl mb-2">Welcome to OneChat</h2>
            <p>Select an AI service from the sidebar</p>
          </div>
        </main>
      )}
    </div>
  )
}

export default App
