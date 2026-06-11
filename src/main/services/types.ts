export interface ServiceConfig {
  id: string
  name: string
  url: string
  icon?: string
}

export interface ServiceState {
  id: string
  name: string
  url: string
  status: 'loading' | 'ready' | 'error'
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
  }
]
