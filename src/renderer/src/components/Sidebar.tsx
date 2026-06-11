import { ServiceState } from '../types'

// Import service icons — place PNG/SVG files in src/renderer/src/assets/icons/
// Filename should match service id: kimi.png, qwen.png, deepseek.png, chatglm.png
import kimiIcon from '../assets/icons/kimi.png'
import qwenIcon from '../assets/icons/qwen.png'
import deepseekIcon from '../assets/icons/deepseek.png'
import chatglmIcon from '../assets/icons/chatglm.png'
import chatgptIcon from '../assets/icons/chatgpt.svg'
import claudeIcon from '../assets/icons/claude.svg'
import grokIcon from '../assets/icons/grok.svg'

interface SidebarProps {
  services: ServiceState[]
  activeId: string | null
  onServiceClick: (id: string) => void
  onSettingsClick: () => void
  settingsActive: boolean
}

const SERVICE_ICONS: Record<string, string> = {
  kimi: kimiIcon,
  qwen: qwenIcon,
  deepseek: deepseekIcon,
  chatglm: chatglmIcon,
  chatgpt: chatgptIcon,
  claude: claudeIcon,
  grok: grokIcon
}

const SERVICE_FALLBACK: Record<string, string> = {
  kimi: 'K',
  qwen: 'Q',
  deepseek: 'D',
  chatglm: 'G',
  chatgpt: 'C',
  claude: 'Cl',
  grok: 'Gr'
}

export function Sidebar({ services, activeId, onServiceClick, onSettingsClick, settingsActive }: SidebarProps) {
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
          className={`relative w-10 h-10 rounded-xl flex items-center justify-center transition-all overflow-hidden ${
            activeId === service.id
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
      <div className="flex-1" />
      <button
        onClick={onSettingsClick}
        title="Settings"
        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
          settingsActive
            ? 'ring-2 ring-blue-500 shadow-lg shadow-blue-600/30 scale-105'
            : 'hover:bg-gray-600 hover:scale-105'
        }`}
      >
        <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
        </svg>
      </button>
    </aside>
  )
}
