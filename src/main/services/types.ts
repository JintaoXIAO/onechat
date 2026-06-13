export interface ServiceConfig {
  id: string
  name: string
  url: string
  icon?: string
  /** Page zoom factor, default 1.0 */
  zoomFactor?: number
  /** Custom user agent (e.g. to request mobile layout) */
  userAgent?: string
}

export interface ServiceState {
  id: string
  name: string
  url: string
  status: 'idle' | 'loading' | 'ready' | 'error'
  visible: boolean
}

// Built-in service definitions
export const BUILTIN_SERVICES: ServiceConfig[] = [
  {
    id: 'kimi',
    name: 'Kimi',
    url: 'https://kimi.moonshot.cn'
  },
  {
    id: 'qwen',
    name: '通义千问',
    url: 'https://tongyi.aliyun.com/qianwen'
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    url: 'https://chat.deepseek.com'
  },
  {
    id: 'chatglm',
    name: 'ChatGLM',
    url: 'https://chatglm.cn'
  },
  {
    id: 'chatgpt',
    name: 'ChatGPT',
    url: 'https://chatgpt.com'
  },
  {
    id: 'claude',
    name: 'Claude',
    url: 'https://claude.ai'
  },
  {
    id: 'grok',
    name: 'Grok',
    url: 'https://grok.com'
  },
  {
    id: 'iciba',
    name: '金山词霸',
    url: 'https://www.iciba.com/',
    zoomFactor: 0.85,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
  }
]
