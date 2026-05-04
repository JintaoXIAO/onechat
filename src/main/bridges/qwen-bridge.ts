import { ipcMain } from 'electron'
import { BaseBridge } from './base-bridge'
import { ChatMessage } from './types'

/**
 * Qwen (通义千问) Bridge
 *
 * Strategy: DOM manipulation + MutationObserver
 * Similar approach to Kimi but adapted to Qwen's page structure.
 */
export class QwenBridge extends BaseBridge {
  readonly serviceId = 'qwen'
  private requestId = 0

  async initialize(): Promise<void> {
    if (!this.view) {
      throw new Error('QwenBridge: No view attached')
    }

    // Wait for the chat interface to load
    await this.waitForElement('textarea', 15000)

    // Inject the bridge script
    await this.injectBridgeScript()
    this.ready = true
  }

  sendMessage(messages: ChatMessage[]): AsyncIterable<string> {
    const { iterable, push, done, error } = this.createStream()
    const reqId = ++this.requestId

    const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user')
    if (!lastUserMessage) {
      setTimeout(() => error(new Error('No user message provided')), 0)
      return iterable
    }

    const chunkChannel = `qwen-stream-chunk-${reqId}`
    const doneChannel = `qwen-stream-done-${reqId}`
    const errorChannel = `qwen-stream-error-${reqId}`

    const chunkHandler = (_event: unknown, chunk: string) => push(chunk)
    const doneHandler = () => { cleanup(); done() }
    const errorHandler = (_event: unknown, errMsg: string) => { cleanup(); error(new Error(errMsg)) }

    const cleanup = () => {
      ipcMain.removeListener(chunkChannel, chunkHandler)
      ipcMain.removeListener(doneChannel, doneHandler)
      ipcMain.removeListener(errorChannel, errorHandler)
    }

    ipcMain.on(chunkChannel, chunkHandler)
    ipcMain.on(doneChannel, doneHandler)
    ipcMain.on(errorChannel, errorHandler)

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
          window.ipcRenderer.send('qwen-stream-error-${reqId}', e.message || 'Unknown error');
        }
      })();
    `
    await this.executeScript(script)
  }

  private async injectBridgeScript(): Promise<void> {
    const script = `
      (() => {
        if (window.__onechat_bridge) return;

        const ipcRenderer = window.ipcRenderer;

        window.__onechat_bridge = {
          currentReqId: null,

          async sendMessage(text, reqId) {
            this.currentReqId = reqId;

            // Qwen uses a textarea for input
            const editor = document.querySelector('textarea')
              || document.querySelector('[contenteditable="true"]');

            if (!editor) {
              ipcRenderer.send('qwen-stream-error-' + reqId, 'Cannot find input element');
              return;
            }

            // Fill the input
            if (editor.tagName === 'TEXTAREA') {
              const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                window.HTMLTextAreaElement.prototype, 'value'
              )?.set;
              nativeInputValueSetter?.call(editor, text);
              editor.dispatchEvent(new Event('input', { bubbles: true }));
              editor.dispatchEvent(new Event('change', { bubbles: true }));
            } else {
              editor.textContent = text;
              editor.dispatchEvent(new Event('input', { bubbles: true }));
            }

            await new Promise(r => setTimeout(r, 200));

            // Find and click the send button
            const sendBtn = document.querySelector('[class*="send"]')
              || document.querySelector('[data-testid*="send"]')
              || document.querySelector('button[class*="submit"]')
              || [...document.querySelectorAll('button')].find(
                  b => b.querySelector('svg') && !b.disabled
                );

            if (sendBtn && !sendBtn.disabled) {
              sendBtn.click();
            } else {
              // Try Enter key
              editor.dispatchEvent(new KeyboardEvent('keydown', {
                key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true
              }));
            }

            this.observeResponse(reqId);
          },

          observeResponse(reqId) {
            let lastText = '';
            let idleTimer = null;
            let settled = false;

            // Find the conversation/message container
            const responseContainer = document.querySelector('[class*="chat-content"]')
              || document.querySelector('[class*="message-list"]')
              || document.querySelector('[class*="conversation"]')
              || document.querySelector('main');

            if (!responseContainer) {
              ipcRenderer.send('qwen-stream-error-' + reqId, 'Cannot find response container');
              return;
            }

            const getLastAssistantText = () => {
              const messages = responseContainer.querySelectorAll('[class*="message"]');
              if (messages.length === 0) return '';
              const lastMsg = messages[messages.length - 1];
              return lastMsg.textContent || '';
            };

            const observer = new MutationObserver(() => {
              if (settled) return;

              const currentText = getLastAssistantText();
              if (currentText && currentText !== lastText) {
                const newChunk = currentText.slice(lastText.length);
                if (newChunk) {
                  ipcRenderer.send('qwen-stream-chunk-' + reqId, newChunk);
                }
                lastText = currentText;
              }

              if (idleTimer) clearTimeout(idleTimer);
              idleTimer = setTimeout(() => {
                settled = true;
                observer.disconnect();
                ipcRenderer.send('qwen-stream-done-' + reqId);
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
                  ipcRenderer.send('qwen-stream-done-' + reqId);
                } else {
                  ipcRenderer.send('qwen-stream-error-' + reqId, 'Response timeout');
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
