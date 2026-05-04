export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface BridgeEvents {
  /** Emitted when a chunk of the response is received (streaming) */
  chunk: (text: string) => void
  /** Emitted when the full response is complete */
  done: (fullText: string) => void
  /** Emitted when an error occurs */
  error: (error: Error) => void
}

/**
 * Bridge interface - each AI service implements this to enable
 * programmatic message sending and response streaming.
 */
export interface Bridge {
  /** Unique service ID */
  readonly serviceId: string

  /** Whether the bridge is ready to send messages */
  isReady(): boolean

  /**
   * Send a message and get streaming response.
   * Returns an async iterable of text chunks.
   */
  sendMessage(messages: ChatMessage[]): AsyncIterable<string>

  /**
   * Initialize the bridge (inject scripts, set up listeners).
   * Called after the BrowserView has loaded.
   */
  initialize(): Promise<void>

  /**
   * Clean up resources.
   */
  destroy(): void
}
