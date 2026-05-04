import { ServiceState } from '../types'

interface SidebarProps {
  services: ServiceState[]
  activeId: string | null
  onServiceClick: (id: string) => void
}

const SERVICE_ICONS: Record<string, string> = {
  kimi: 'K',
  qwen: 'Q',
  deepseek: 'D',
  chatglm: 'G'
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

  return (
    <aside className="w-14 bg-gray-800 border-r border-gray-700 flex flex-col items-center py-3 gap-2">
      {services.map((service) => (
        <button
          key={service.id}
          onClick={() => onServiceClick(service.id)}
          title={service.name}
          className={`relative w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold transition-all ${
            activeId === service.id
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 scale-105'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white'
          }`}
        >
          {SERVICE_ICONS[service.id] || service.name[0]}
          <span
            className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-gray-800 ${statusColor(service.status)}`}
          />
        </button>
      ))}
    </aside>
  )
}
