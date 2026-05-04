import { ipcMain } from 'electron'
import { BaseBridge } from './base-bridge'
import { ChatMessage } from './types'

/**
 * Kimi (Moonshot) Bridge
 *
 * Strategy: DOM manipulation + MutationObserver
 * Kimi's page uses:
 *   - Input: div.chat-input-editor (contenteditable)
 *   - Send button: element within div.chat-editor-action (not a <button>)
 *   - Response container: elements with class containing "message" or "segment"
 */
export class KimiBridge extends BaseBridge {
  readonly serviceId = 'kimi'
  private requestId = 0

  async initialize(): Promise<void> {
    if (!this.view) {
      throw new Error('KimiBridge: No view attached')
    }

    // Wait for the chat input editor to appear
    await this.waitForElement('.chat-input-editor', 15000)

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

    const chunkChannel = `kimi-stream-chunk-${reqId}`
    const doneChannel = `kimi-stream-done-${reqId}`
    const errorChannel = `kimi-stream-error-${reqId}`

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
          window.ipcRenderer.send('kimi-stream-error-${reqId}', e.message || 'Unknown error');
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

            // Kimi uses div.chat-input-editor with contenteditable
            const editor = document.querySelector('.chat-input-editor');

            if (!editor) {
              ipcRenderer.send('kimi-stream-error-' + reqId, 'Cannot find .chat-input-editor');
              return;
            }

            // Focus the editor
            editor.focus();

            // Clear existing content
            editor.innerHTML = '';

            // Use execCommand to insert text — this simulates real user typing
            // and triggers all the framework's internal event handlers
            document.execCommand('insertText', false, text);

            // Also dispatch input event as backup
            editor.dispatchEvent(new Event('input', { bubbles: true }));

            // Wait for the framework to process and enable the send button
            await new Promise(r => setTimeout(r, 500));

            // Now look for the send button (should be enabled after content is set)
            // Try multiple strategies to find it
            let sendClicked = false;

            // Strategy 1: Look for element with "send" in class name
            const sendByClass = document.querySelector('[class*="send"]:not([disabled])');
            if (sendByClass) {
              sendByClass.click();
              sendClicked = true;
            }

            // Strategy 2: Look inside .chat-editor-action for clickable elements
            if (!sendClicked) {
              const actionArea = document.querySelector('.chat-editor-action');
              if (actionArea) {
                // Find the last icon/button-like element (usually the send icon)
                const clickables = actionArea.querySelectorAll('svg, [role="button"], [class*="icon"], [class*="btn"]');
                if (clickables.length > 0) {
                  const sendIcon = clickables[clickables.length - 1];
                  (sendIcon.closest('[class*="send"]') || sendIcon.parentElement || sendIcon).click();
                  sendClicked = true;
                }
              }
            }

            // Strategy 3: Enter key as final fallback
            if (!sendClicked) {
              editor.dispatchEvent(new KeyboardEvent('keydown', {
                key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true
              }));
            }

            // Start observing for response
            this.observeResponse(reqId);
          },

          observeResponse(reqId) {
            let lastText = '';
            let idleTimer = null;
            let settled = false;

            // Kimi navigates to a chat-detail page after sending.
            // The response lives in: div.segment > div.segment-content-box > div.markdown-container
            // We need to observe document.body since the container may not exist yet.
            const observeTarget = document.body;

            console.log('[OneChat] observing document.body for .markdown-container changes');

            const getAssistantText = () => {
              // Find all assistant response blocks (markdown containers within segments)
              const markdowns = document.querySelectorAll('.segment .markdown-container');
              if (markdowns.length === 0) return '';

              // Get the last markdown container — that's the latest AI response
              const lastMarkdown = markdowns[markdowns.length - 1];
              return lastMarkdown.innerText || lastMarkdown.textContent || '';
            };

            const observer = new MutationObserver(() => {
              if (settled) return;

              const currentText = getAssistantText();
              if (currentText && currentText !== lastText) {
                const newChunk = currentText.slice(lastText.length);
                if (newChunk) {
                  ipcRenderer.send('kimi-stream-chunk-' + reqId, newChunk);
                }
                lastText = currentText;
              }

              // Reset idle timer — if no mutations for 3s, response is complete
              if (idleTimer) clearTimeout(idleTimer);
              idleTimer = setTimeout(() => {
                // Final read
                const finalText = getAssistantText();
                if (finalText && finalText !== lastText) {
                  const remaining = finalText.slice(lastText.length);
                  if (remaining) {
                    ipcRenderer.send('kimi-stream-chunk-' + reqId, remaining);
                  }
                }
                settled = true;
                observer.disconnect();
                ipcRenderer.send('kimi-stream-done-' + reqId);
              }, 3000);
            });

            observer.observe(observeTarget, {
              childList: true,
              subtree: true,
              characterData: true
            });

            // Timeout after 90 seconds
            setTimeout(() => {
              if (!settled) {
                settled = true;
                observer.disconnect();
                if (lastText) {
                  ipcRenderer.send('kimi-stream-done-' + reqId);
                } else {
                  ipcRenderer.send('kimi-stream-error-' + reqId, 'Response timeout - no .markdown-container found');
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
