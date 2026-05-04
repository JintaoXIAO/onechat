import { ipcMain } from 'electron'
import { BaseBridge } from './base-bridge'
import { ChatMessage } from './types'

/**
 * Kimi (Moonshot) Bridge
 *
 * Strategy: Network interception via in-page fetch hook.
 * Kimi's chat uses a streaming API endpoint. We intercept the native fetch
 * to capture the streaming response, and also manipulate the DOM to send messages.
 */
export class KimiBridge extends BaseBridge {
  readonly serviceId = 'kimi'
  private requestId = 0

  async initialize(): Promise<void> {
    if (!this.view) {
      throw new Error('KimiBridge: No view attached')
    }

    // Wait for the chat interface to load
    await this.waitForElement('[class*="chat"]', 15000)

    // Inject the bridge script that hooks into the page
    await this.injectBridgeScript()
    this.ready = true
  }

  sendMessage(messages: ChatMessage[]): AsyncIterable<string> {
    const { iterable, push, done, error } = this.createStream()
    const reqId = ++this.requestId

    // Get the last user message to send
    const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user')
    if (!lastUserMessage) {
      setTimeout(() => error(new Error('No user message provided')), 0)
      return iterable
    }

    // Set up IPC listener for this specific request's streaming chunks
    const chunkChannel = `kimi-stream-chunk-${reqId}`
    const doneChannel = `kimi-stream-done-${reqId}`
    const errorChannel = `kimi-stream-error-${reqId}`

    const chunkHandler = (_event: unknown, chunk: string) => {
      push(chunk)
    }
    const doneHandler = () => {
      cleanup()
      done()
    }
    const errorHandler = (_event: unknown, errMsg: string) => {
      cleanup()
      error(new Error(errMsg))
    }

    const cleanup = () => {
      ipcMain.removeListener(chunkChannel, chunkHandler)
      ipcMain.removeListener(doneChannel, doneHandler)
      ipcMain.removeListener(errorChannel, errorHandler)
    }

    ipcMain.on(chunkChannel, chunkHandler)
    ipcMain.on(doneChannel, doneHandler)
    ipcMain.on(errorChannel, errorHandler)

    // Execute the send command in the page
    this.executeSend(lastUserMessage.content, reqId).catch((err) => {
      cleanup()
      error(err)
    })

    return iterable
  }

  private async executeSend(text: string, reqId: number): Promise<void> {
    const script = `
      (async () => {
        try {
          await window.__onechat_bridge.sendMessage(${JSON.stringify(text)}, ${reqId});
        } catch(e) {
          window.ipcRenderer.send('kimi-stream-error-${reqId}', e.message || 'Unknown error');
        }
      })();
    `
    await this.executeScript(script)
  }

  private async injectBridgeScript(): Promise<void> {
    // This script runs in the Kimi webpage context.
    // It hooks fetch to intercept streaming responses and provides
    // a sendMessage method that triggers the chat input.
    const script = `
      (() => {
        if (window.__onechat_bridge) return; // Already injected

        const ipcRenderer = window.ipcRenderer;

        window.__onechat_bridge = {
          currentReqId: null,

          async sendMessage(text, reqId) {
            this.currentReqId = reqId;

            // Find the textarea/input and fill it
            const editor = document.querySelector('[class*="editor"]') 
              || document.querySelector('textarea')
              || document.querySelector('[contenteditable="true"]');
            
            if (!editor) {
              ipcRenderer.send('kimi-stream-error-' + reqId, 'Cannot find input element');
              return;
            }

            // Set the value using input events for React to pick up
            if (editor.tagName === 'TEXTAREA' || editor.tagName === 'INPUT') {
              const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                window.HTMLTextAreaElement.prototype, 'value'
              )?.set || Object.getOwnPropertyDescriptor(
                window.HTMLInputElement.prototype, 'value'
              )?.set;
              nativeInputValueSetter?.call(editor, text);
              editor.dispatchEvent(new Event('input', { bubbles: true }));
            } else {
              // contenteditable
              editor.textContent = text;
              editor.dispatchEvent(new Event('input', { bubbles: true }));
            }

            // Small delay then click send button
            await new Promise(r => setTimeout(r, 100));

            const sendBtn = document.querySelector('[class*="send"]')
              || document.querySelector('button[data-testid*="send"]')
              || [...document.querySelectorAll('button')].find(
                  b => b.textContent?.includes('发送') || b.querySelector('svg')
                );

            if (sendBtn && !sendBtn.disabled) {
              sendBtn.click();
            } else {
              // Try pressing Enter
              editor.dispatchEvent(new KeyboardEvent('keydown', {
                key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true
              }));
            }

            // Start observing the response area for changes
            this.observeResponse(reqId);
          },

          observeResponse(reqId) {
            // Use MutationObserver to watch for new response content
            let lastText = '';
            let idleTimer = null;
            let settled = false;

            const responseContainer = document.querySelector('[class*="message-list"]')
              || document.querySelector('[class*="conversation"]')
              || document.querySelector('main');

            if (!responseContainer) {
              ipcRenderer.send('kimi-stream-error-' + reqId, 'Cannot find response container');
              return;
            }

            const getLastAssistantText = () => {
              // Get the last assistant message block
              const messages = responseContainer.querySelectorAll('[class*="message"]');
              if (messages.length === 0) return '';
              const lastMsg = messages[messages.length - 1];
              // Skip if it's the user's message
              if (lastMsg.querySelector('[class*="user"]')) return '';
              return lastMsg.textContent || '';
            };

            const observer = new MutationObserver(() => {
              if (settled) return;

              const currentText = getLastAssistantText();
              if (currentText && currentText !== lastText) {
                const newChunk = currentText.slice(lastText.length);
                if (newChunk) {
                  ipcRenderer.send('kimi-stream-chunk-' + reqId, newChunk);
                }
                lastText = currentText;
              }

              // Reset idle timer
              if (idleTimer) clearTimeout(idleTimer);
              idleTimer = setTimeout(() => {
                // No mutations for 2 seconds = response complete
                settled = true;
                observer.disconnect();
                ipcRenderer.send('kimi-stream-done-' + reqId);
              }, 2000);
            });

            observer.observe(responseContainer, {
              childList: true,
              subtree: true,
              characterData: true
            });

            // Timeout after 60 seconds
            setTimeout(() => {
              if (!settled) {
                settled = true;
                observer.disconnect();
                if (lastText) {
                  ipcRenderer.send('kimi-stream-done-' + reqId);
                } else {
                  ipcRenderer.send('kimi-stream-error-' + reqId, 'Response timeout');
                }
              }
            }, 60000);
          }
        };
      })();
    `
    await this.executeScript(script)
  }
}
