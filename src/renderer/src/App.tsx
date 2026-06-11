import { useEffect, useState } from 'react'
import { Sidebar } from './components/Sidebar'
import { WelcomeScreen } from './components/WelcomeScreen'
import { SettingsPage } from './components/SettingsPage'
import { ServiceState } from './types'

function App(): React.ReactElement {
  const [services, setServices] = useState<ServiceState[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)

  useEffect(() => {
    window.api.getServices().then(setServices)
    window.api.getActiveService().then(setActiveId)

    const unsubscribe = window.api.onServiceStateChanged((updated) => {
      setServices(updated as ServiceState[])
      const active = (updated as ServiceState[]).find((s) => s.visible)
      setActiveId(active?.id ?? null)
    })

    return unsubscribe
  }, [])

  const handleServiceClick = async (id: string) => {
    setShowSettings(false)
    if (activeId === id) {
      await window.api.hideService(id)
      setActiveId(null)
    } else {
      await window.api.showService(id)
      setActiveId(id)
    }
  }

  const handleSettingsClick = () => {
    // Hide active service view when opening settings
    if (activeId) {
      window.api.hideService(activeId)
      setActiveId(null)
    }
    setShowSettings(true)
  }

  return (
    <div className="flex h-screen bg-gray-900 text-white">
      <Sidebar
        services={services}
        activeId={activeId}
        onServiceClick={handleServiceClick}
        onSettingsClick={handleSettingsClick}
        settingsActive={showSettings}
      />
      {showSettings && <SettingsPage services={services} />}
      {!showSettings && !activeId && <WelcomeScreen />}
    </div>
  )
}

export default App
