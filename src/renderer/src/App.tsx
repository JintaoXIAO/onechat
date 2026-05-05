import { useEffect, useState } from 'react'
import { Sidebar } from './components/Sidebar'
import { WelcomeScreen } from './components/WelcomeScreen'
import { BroadcastView } from './components/BroadcastView'
import { ServiceState } from './types'

function App(): React.ReactElement {
  const [services, setServices] = useState<ServiceState[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [broadcastMode, setBroadcastMode] = useState(false)

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
    // Exit broadcast mode when clicking a service
    setBroadcastMode(false)

    if (activeId === id) {
      await window.api.hideService(id)
      setActiveId(null)
    } else {
      await window.api.showService(id)
      setActiveId(id)
    }
  }

  const handleBroadcastClick = async () => {
    // Hide any active service view
    if (activeId) {
      await window.api.hideService(activeId)
      setActiveId(null)
    }
    setBroadcastMode(true)
  }

  return (
    <div className="flex h-screen bg-gray-900 text-white">
      <Sidebar
        services={services}
        activeId={activeId}
        broadcastMode={broadcastMode}
        onServiceClick={handleServiceClick}
        onBroadcastClick={handleBroadcastClick}
      />
      {broadcastMode ? (
        <BroadcastView services={services} />
      ) : !activeId ? (
        <WelcomeScreen />
      ) : null}
    </div>
  )
}

export default App
