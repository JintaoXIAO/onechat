import { ipcMain } from 'electron'
import { BaseBridge } from './base-bridge'
import { ChatMessage } from './types'

/**
 * DeepSeek Bridge
 *
 * Strategy: DOM manipulation + MutationObserver
 * DeepSeek chat (chat.deepseek.com) uses a textarea for input.
 */
export class DeepSeekBridge extends BaseBridge {
  readonly serviceId = 'deepseek'
  private requestId = 0

  async initialize(): Promise<void> {
    if (!this.view) {
      throw new Error('DeepSeekBridge: No view attached')
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

    const chunkChannel = `deepseek-stream-chunk-${reqId}`
    const doneChannel = `deepseek-stream-done-${reqId}`
    const errorChannel = `deepseek-stream-error-${reqId}`

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
          window.ipcRenderer.send('deepseek-stream-error-${reqId}', e.message || 'Unknown error');
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

            // DeepSeek uses a textarea for input
            const editor = document.querySelector('textarea')
              || document.querySelector('[contenteditable="true"]');

            if (!editor) {
              ipcRenderer.send('deepseek-stream-error-' + reqId, 'Cannot find input element');
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
              editor.focus();
              editor.innerHTML = '';
              document.execCommand('insertText', false, text);
              editor.dispatchEvent(new Event('input', { bubbles: true }));
            }

            // Wait for send button to become active
            await new Promise(r => setTimeout(r, 500));

            // Find and click send button
            let sendClicked = false;

            // Strategy 1: button with specific selectors
            const sendBtn = document.querySelector('[data-testid="send-button"]')
              || document.querySelector('[class*="send"]:not([disabled])')
              || document.querySelector('[aria-label*="send" i]')
              || document.querySelector('[aria-label*="发送" i]');

            if (sendBtn && !sendBtn.disabled) {
              sendBtn.click();
              sendClicked = true;
            }

            // Strategy 2: Find the last enabled button near the textarea
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
            let hasStarted = false;

            console.log('[OneChat] DeepSeek observing for response');

            const getAssistantText = () => {
              // DeepSeek uses: div.ds-message > div.ds-markdown for AI responses
              const markdowns = document.querySelectorAll('.ds-message .ds-markdown');
              if (markdowns.length === 0) return '';
              const lastMarkdown = markdowns[markdowns.length - 1];
              return lastMarkdown.innerText || lastMarkdown.textContent || '';
            };

            // Use both MutationObserver AND polling because DeepSeek
            // does a route navigation after sending, which can cause
            // the observer to miss the initial content appearing.
            const pollInterval = setInterval(() => {
              if (settled) { clearInterval(pollInterval); return; }

              const currentText = getAssistantText();
              if (currentText && currentText !== lastText) {
                hasStarted = true;
                const newChunk = currentText.slice(lastText.length);
                if (newChunk) {
                  ipcRenderer.send('deepseek-stream-chunk-' + reqId, newChunk);
                }
                lastText = currentText;

                // Reset idle timer
                if (idleTimer) clearTimeout(idleTimer);
                idleTimer = setTimeout(() => {
                  // Final check
                  const finalText = getAssistantText();
                  if (finalText && finalText !== lastText) {
                    ipcRenderer.send('deepseek-stream-chunk-' + reqId, finalText.slice(lastText.length));
                  }
                  settled = true;
                  clearInterval(pollInterval);
                  ipcRenderer.send('deepseek-stream-done-' + reqId);
                }, 3000);
              }
            }, 500);

            // Timeout after 90 seconds
            setTimeout(() => {
              if (!settled) {
                settled = true;
                clearInterval(pollInterval);
                if (idleTimer) clearTimeout(idleTimer);
                if (lastText) {
                  ipcRenderer.send('deepseek-stream-done-' + reqId);
                } else {
                  ipcRenderer.send('deepseek-stream-error-' + reqId, 'Response timeout');
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
