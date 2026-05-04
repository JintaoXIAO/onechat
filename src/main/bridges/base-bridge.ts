import { WebContentsView } from 'electron'
import { Bridge, ChatMessage } from './types'

/**
 * Abstract base class for bridges. Provides common utilities for
 * injecting scripts and communicating with a BrowserView's webContents.
 */
export abstract class BaseBridge implements Bridge {
  abstract readonly serviceId: string
  protected view: WebContentsView | null = null
  protected ready = false

  setView(view: WebContentsView): void {
    this.view = view
  }

  isReady(): boolean {
    return this.ready && this.view !== null
  }

  abstract sendMessage(messages: ChatMessage[]): AsyncIterable<string>
  abstract initialize(): Promise<void>

  destroy(): void {
    this.ready = false
    this.view = null
  }

  /**
   * Execute JavaScript in the service's webContents.
   * Returns the result of the script execution.
   */
  protected async executeScript<T = unknown>(script: string): Promise<T> {
    if (!this.view) {
      throw new Error(`Bridge ${this.serviceId}: No view attached`)
    }
    return this.view.webContents.executeJavaScript(script) as Promise<T>
  }

  /**
   * Wait for an element to appear in the page DOM.
   * Useful for waiting for the chat interface to fully load.
   */
  protected async waitForElement(selector: string, timeoutMs = 10000): Promise<boolean> {
    const script = `
      new Promise((resolve) => {
        const existing = document.querySelector(${JSON.stringify(selector)});
        if (existing) { resolve(true); return; }

        const observer = new MutationObserver(() => {
          if (document.querySelector(${JSON.stringify(selector)})) {
            observer.disconnect();
            resolve(true);
          }
        });
        observer.observe(document.body, { childList: true, subtree: true });

        setTimeout(() => {
          observer.disconnect();
          resolve(false);
        }, ${timeoutMs});
      })
    `
    return this.executeScript<boolean>(script)
  }

  /**
   * Set up a network request interceptor on the webContents.
   * Useful for bridges that use the network interception strategy.
   */
  protected setupRequestInterceptor(
    urlPattern: string,
    callback: (data: string) => void
  ): void {
    if (!this.view) return

    this.view.webContents.session.webRequest.onCompleted(
      { urls: [urlPattern] },
      (details) => {
        // The response body isn't available here directly;
        // for streaming we'll rely on in-page script injection instead.
        callback(JSON.stringify(details))
      }
    )
  }

  /**
   * Helper to create an AsyncIterable from a callback-based streaming mechanism.
   * Subclasses call `push(chunk)` to emit data and `done()` to signal completion.
   */
  protected createStream(): {
    iterable: AsyncIterable<string>
    push: (chunk: string) => void
    done: () => void
    error: (err: Error) => void
  } {
    const queue: string[] = []
    let finished = false
    let streamError: Error | null = null
    let resolver: (() => void) | null = null

    const iterable: AsyncIterable<string> = {
      [Symbol.asyncIterator]() {
        return {
          async next(): Promise<IteratorResult<string>> {
            while (true) {
              if (queue.length > 0) {
                return { value: queue.shift()!, done: false }
              }
              if (streamError) {
                throw streamError
              }
              if (finished) {
                return { value: undefined as unknown as string, done: true }
              }
              // Wait for new data
              await new Promise<void>((resolve) => {
                resolver = resolve
              })
            }
          }
        }
      }
    }

    const notify = () => {
      if (resolver) {
        const r = resolver
        resolver = null
        r()
      }
    }

    return {
      iterable,
      push: (chunk: string) => {
        queue.push(chunk)
        notify()
      },
      done: () => {
        finished = true
        notify()
      },
      error: (err: Error) => {
        streamError = err
        notify()
      }
    }
  }
}
