import { ServiceState } from '../types'

// Import service icons
import kimiIcon from '../assets/icons/kimi.png'
import qwenIcon from '../assets/icons/qwen.png'
import deepseekIcon from '../assets/icons/deepseek.png'
import chatglmIcon from '../assets/icons/chatglm.png'

interface SidebarProps {
  services: ServiceState[]
  activeId: string | null
  broadcastMode: boolean
  onServiceClick: (id: string) => void
  onBroadcastClick: () => void
}

const SERVICE_ICONS: Record<string, string> = {
  kimi: kimiIcon,
  qwen: qwenIcon,
  deepseek: deepseekIcon,
  chatglm: chatglmIcon
}

const SERVICE_FALLBACK: Record<string, string> = {
  kimi: 'K',
  qwen: 'Q',
  deepseek: 'D',
  chatglm: 'G'
}

export function Sidebar({ services, activeId, broadcastMode, onServiceClick, onBroadcastClick }: SidebarProps) {
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
      {/* Service icons */}
      {services.map((service) => (
        <button
          key={service.id}
          onClick={() => onServiceClick(service.id)}
          title={service.name}
          className={`relative w-10 h-10 rounded-xl flex items-center justify-center transition-all overflow-hidden ${
            activeId === service.id && !broadcastMode
              ? 'ring-2 ring-blue-500 shadow-lg shadow-blue-600/30 scale-105'
              : 'hover:bg-gray-600 hover:scale-105'
          }`}
        >
          {SERVICE_ICONS[service.id] ? (
            <img
              src={SERVICE_ICONS[service.id]}
              alt={service.name}
              className="w-8 h-8 rounded-lg object-contain"
            />
          ) : (
            <span className="text-sm font-bold text-gray-300">
              {SERVICE_FALLBACK[service.id] || service.name[0]}
            </span>
          )}
          <span
            className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-gray-800 ${statusColor(service.status)}`}
          />
        </button>
      ))}

      {/* Divider */}
      <div className="w-6 h-px bg-gray-600 my-1" />

      {/* Broadcast button */}
      <button
        onClick={onBroadcastClick}
        title="Broadcast - 同时发送给所有 AI"
        className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg transition-all ${
          broadcastMode
            ? 'bg-purple-600 text-white ring-2 ring-purple-400 shadow-lg shadow-purple-600/30 scale-105'
            : 'bg-gray-700 text-gray-400 hover:bg-gray-600 hover:text-white hover:scale-105'
        }`}
      >
        ⚡
      </button>
    </aside>
  )
}
