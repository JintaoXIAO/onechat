import { ipcMain } from 'electron'
import { BaseBridge } from './base-bridge'
import { ChatMessage } from './types'

/**
 * ChatGLM Bridge
 *
 * Strategy: DOM manipulation + MutationObserver
 * ChatGLM (chatglm.cn) uses a textarea for input.
 */
export class ChatGLMBridge extends BaseBridge {
  readonly serviceId = 'chatglm'
  private requestId = 0

  async initialize(): Promise<void> {
    if (!this.view) {
      throw new Error('ChatGLMBridge: No view attached')
    }

    // Wait for the chat interface to load
    await this.waitForElement('textarea', 15000)

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

    const chunkChannel = `chatglm-stream-chunk-${reqId}`
    const doneChannel = `chatglm-stream-done-${reqId}`
    const errorChannel = `chatglm-stream-error-${reqId}`

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
          window.ipcRenderer.send('chatglm-stream-error-${reqId}', e.message || 'Unknown error');
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

            // ChatGLM uses a textarea for input
            const editor = document.querySelector('textarea')
              || document.querySelector('[contenteditable="true"]');

            if (!editor) {
              ipcRenderer.send('chatglm-stream-error-' + reqId, 'Cannot find input element');
              return;
            }

            // Focus and fill input
            editor.focus();

            if (editor.tagName === 'TEXTAREA') {
              const nativeSet = Object.getOwnPropertyDescriptor(
                window.HTMLTextAreaElement.prototype, 'value'
              )?.set;
              nativeSet?.call(editor, text);
              editor.dispatchEvent(new Event('input', { bubbles: true }));
              editor.dispatchEvent(new Event('change', { bubbles: true }));
            } else {
              editor.innerHTML = '';
              document.execCommand('insertText', false, text);
              editor.dispatchEvent(new Event('input', { bubbles: true }));
            }

            // Wait for send button to become active
            await new Promise(r => setTimeout(r, 500));

            // Find and click send button
            let sendClicked = false;

            const sendBtn = document.querySelector('[data-testid="send-button"]')
              || document.querySelector('[class*="send"]:not([disabled])')
              || document.querySelector('[aria-label*="send" i]')
              || document.querySelector('[aria-label*="发送" i]');

            if (sendBtn && !sendBtn.disabled) {
              sendBtn.click();
              sendClicked = true;
            }

            // Strategy 2: button near textarea
            if (!sendClicked) {
              const form = editor.closest('form') || editor.parentElement?.parentElement;
              if (form) {
                const buttons = form.querySelectorAll('button:not([disabled])');
                if (buttons.length > 0) {
                  buttons[buttons.length - 1].click();
                  sendClicked = true;
                }
              }
            }

            // Strategy 3: Enter key
            if (!sendClicked) {
              editor.dispatchEvent(new KeyboardEvent('keydown', {
                key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true
              }));
            }

            // Observe response
            this.observeResponse(reqId);
          },

          observeResponse(reqId) {
            let lastText = '';
            let idleTimer = null;
            let settled = false;

            console.log('[OneChat] ChatGLM observing document.body for response');

            const getAssistantText = () => {
              // ChatGLM renders responses in markdown blocks
              const markdowns = document.querySelectorAll('[class*="markdown"]');
              if (markdowns.length === 0) {
                const msgs = document.querySelectorAll('[class*="message"]');
                if (msgs.length === 0) return '';
                const last = msgs[msgs.length - 1];
                return last.innerText || '';
              }
              const lastMarkdown = markdowns[markdowns.length - 1];
              return lastMarkdown.innerText || lastMarkdown.textContent || '';
            };

            const observer = new MutationObserver(() => {
              if (settled) return;

              const currentText = getAssistantText();
              if (currentText && currentText !== lastText) {
                const newChunk = currentText.slice(lastText.length);
                if (newChunk) {
                  ipcRenderer.send('chatglm-stream-chunk-' + reqId, newChunk);
                }
                lastText = currentText;
              }

              if (idleTimer) clearTimeout(idleTimer);
              idleTimer = setTimeout(() => {
                const finalText = getAssistantText();
                if (finalText && finalText !== lastText) {
                  const remaining = finalText.slice(lastText.length);
                  if (remaining) {
                    ipcRenderer.send('chatglm-stream-chunk-' + reqId, remaining);
                  }
                }
                settled = true;
                observer.disconnect();
                ipcRenderer.send('chatglm-stream-done-' + reqId);
              }, 3000);
            });

            observer.observe(document.body, {
              childList: true,
              subtree: true,
              characterData: true
            });

            setTimeout(() => {
              if (!settled) {
                settled = true;
                observer.disconnect();
                if (lastText) {
                  ipcRenderer.send('chatglm-stream-done-' + reqId);
                } else {
                  ipcRenderer.send('chatglm-stream-error-' + reqId, 'Response timeout');
                }
              }
            }, 90000);
          }
        };
      })();
    `
    await this.executeScript(script)
  }
}
