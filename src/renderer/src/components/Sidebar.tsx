import { ServiceState } from '../types'

interface SidebarProps {
  services: ServiceState[]
  activeId: string | null
  onServiceClick: (id: string) => void
}

export function Sidebar({ services, activeId, onServiceClick }: SidebarProps) {
  const statusColor = (status: ServiceState['status']) => {
    switch (status) {
      case 'ready':
        return 'bg-green-400'
      case 'loading':
        return 'bg-yellow-400 animate-pulse'
      case 'error':
        return 'bg-red-400'
    }
  }

  const statusLabel = (status: ServiceState['status']) => {
    switch (status) {
      case 'ready':
        return 'Ready'
      case 'loading':
        return 'Loading...'
      case 'error':
        return 'Error'
    }
  }

  return (
    <aside className="w-64 bg-gray-800 border-r border-gray-700 flex flex-col">
      <div className="p-4 border-b border-gray-700">
        <h1 className="text-xl font-bold">OneChat</h1>
        <p className="text-gray-400 text-xs mt-1">AI Service Aggregator</p>
      </div>

      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Services
        </div>
        {services.map((service) => (
          <button
            key={service.id}
            onClick={() => onServiceClick(service.id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors group ${
              activeId === service.id
                ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30'
                : 'hover:bg-gray-700/50 text-gray-300'
            }`}
          >
            <span
              className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${statusColor(service.status)}`}
              title={statusLabel(service.status)}
            />
            <span className="truncate flex-1">{service.name}</span>
            {activeId === service.id && (
              <span className="text-xs text-blue-400">Active</span>
            )}
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-gray-700">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>
            {services.filter((s) => s.status === 'ready').length}/{services.length} ready
          </span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
            API :11434
          </span>
        </div>
      </div>
    </aside>
  )
}
