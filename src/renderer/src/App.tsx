import { useEffect, useState } from 'react'
import { Sidebar } from './components/Sidebar'
import { WelcomeScreen } from './components/WelcomeScreen'
import { ServiceState } from './types'

function App(): React.ReactElement {
  const [services, setServices] = useState<ServiceState[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)

  useEffect(() => {
    // Load initial services
    window.api.getServices().then(setServices)
    window.api.getActiveService().then(setActiveId)

    // Listen for state changes from main process
    const unsubscribe = window.api.onServiceStateChanged((updated) => {
      setServices(updated as ServiceState[])
      const active = (updated as ServiceState[]).find((s) => s.visible)
      setActiveId(active?.id ?? null)
    })

    return unsubscribe
  }, [])

  const handleServiceClick = async (id: string) => {
    if (activeId === id) {
      await window.api.hideService(id)
      setActiveId(null)
    } else {
      await window.api.showService(id)
      setActiveId(id)
    }
  }

  return (
    <div className="flex h-screen bg-gray-900 text-white">
      <Sidebar
        services={services}
        activeId={activeId}
        onServiceClick={handleServiceClick}
      />
      {/* When a service is active, its WebContentsView is rendered by Electron
          directly on top of this area, so we only show WelcomeScreen when nothing is active */}
      {!activeId && <WelcomeScreen />}
    </div>
  )
}

export default App
