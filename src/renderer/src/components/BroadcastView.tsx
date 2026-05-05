import { useState, useEffect, useRef } from 'react'
import { ServiceState } from '../types'

interface BroadcastResponse {
  serviceId: string
  serviceName: string
  status: 'idle' | 'streaming' | 'done' | 'error'
  content: string
  error?: string
}

interface BroadcastViewProps {
  services: ServiceState[]
}

export function BroadcastView({ services }: BroadcastViewProps) {
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [responses, setResponses] = useState<BroadcastResponse[]>([])
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Initialize response slots for all services
  const readyServices = services.filter((s) => s.status === 'ready')

  const handleSend = async () => {
    const message = input.trim()
    if (!message || sending) return

    setSending(true)
    setInput('')

    // Initialize all response slots
    const initialResponses: BroadcastResponse[] = readyServices.map((s) => ({
      serviceId: s.id,
      serviceName: s.name,
      status: 'streaming',
      content: ''
    }))
    setResponses(initialResponses)

    // Get list of services that will respond
    const serviceIds: string[] = await window.api.broadcastSend(message)

    // Set up listeners and trigger streams for each service
    const cleanups: (() => void)[] = []

    for (const serviceId of serviceIds) {
      // Chunk listener
      const unsubChunk = window.api.onBroadcastChunk(serviceId, (chunk) => {
        setResponses((prev) =>
          prev.map((r) =>
            r.serviceId === serviceId
              ? { ...r, content: r.content + chunk, status: 'streaming' }
              : r
          )
        )
      })
      cleanups.push(unsubChunk)

      // Done listener
      const unsubDone = window.api.onBroadcastDone(serviceId, () => {
        setResponses((prev) =>
          prev.map((r) =>
            r.serviceId === serviceId ? { ...r, status: 'done' } : r
          )
        )
      })
      cleanups.push(unsubDone)

      // Error listener
      const unsubError = window.api.onBroadcastError(serviceId, (error) => {
        setResponses((prev) =>
          prev.map((r) =>
            r.serviceId === serviceId
              ? { ...r, status: 'error', error }
              : r
          )
        )
      })
      cleanups.push(unsubError)

      // Start streaming (don't await - let them run in parallel)
      window.api.broadcastStream(serviceId, message)
    }

    // Mark services without bridges as error
    setResponses((prev) =>
      prev.map((r) =>
        !serviceIds.includes(r.serviceId)
          ? { ...r, status: 'error', error: 'Bridge not ready' }
          : r
      )
    )

    // Wait for all to complete (check periodically)
    const checkDone = setInterval(() => {
      setResponses((prev) => {
        const allDone = prev.every((r) => r.status === 'done' || r.status === 'error')
        if (allDone) {
          clearInterval(checkDone)
          setSending(false)
          cleanups.forEach((fn) => fn())
        }
        return prev
      })
    }, 500)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const statusBadge = (status: BroadcastResponse['status']) => {
    switch (status) {
      case 'idle':
        return <span className="text-xs text-gray-500">Idle</span>
      case 'streaming':
        return <span className="text-xs text-blue-400 animate-pulse">Streaming...</span>
      case 'done':
        return <span className="text-xs text-green-400">Done</span>
      case 'error':
        return <span className="text-xs text-red-400">Error</span>
    }
  }

  return (
    <div className="flex-1 flex flex-col h-screen bg-gray-900">
      {/* Input area */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex gap-3 items-end max-w-full">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入问题，同时发送到所有 AI..."
            rows={2}
            className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-500 resize-none focus:outline-none focus:border-blue-500 transition-colors"
            disabled={sending}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
          >
            {sending ? '发送中...' : '广播'}
          </button>
        </div>
      </div>

      {/* Response grid */}
      {responses.length > 0 ? (
        <div className="flex-1 grid grid-cols-2 gap-px bg-gray-700 overflow-hidden">
          {responses.map((resp) => (
            <div
              key={resp.serviceId}
              className="bg-gray-900 flex flex-col overflow-hidden"
            >
              {/* Service header */}
              <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700 shrink-0">
                <span className="font-medium text-sm">{resp.serviceName}</span>
                {statusBadge(resp.status)}
              </div>
              {/* Response content */}
              <div className="flex-1 overflow-y-auto p-4 text-sm text-gray-200 whitespace-pre-wrap">
                {resp.content || (
                  resp.status === 'error' ? (
                    <span className="text-red-400">{resp.error}</span>
                  ) : (
                    <span className="text-gray-500">等待回复...</span>
                  )
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-500">
          <div className="text-center">
            <div className="text-4xl mb-4">📡</div>
            <h3 className="text-lg font-medium text-gray-300 mb-2">Broadcast Mode</h3>
            <p>输入问题后同时发送给所有 AI，对比查看回复</p>
            <p className="text-sm mt-2">
              {readyServices.length} 个服务就绪：
              {readyServices.map((s) => s.name).join('、')}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
