import { ipcMain, WebContentsView } from 'electron'
import { BaseBridge } from './base-bridge'
import { ChatMessage } from './types'

/**
 * Qwen (通义千问) Bridge
 *
 * Strategy: Electron sendInputEvent for typing + polling for response
 * Qwen's framework ignores programmatic DOM changes. We must use Electron's
 * native input simulation to trigger real keyboard events that the framework detects.
 *
 * - Input: div[contenteditable] (rich text editor)
 * - Send: Enter key via sendInputEvent (button stays disabled with DOM manipulation)
 * - Response: div.chat-answers-card-wrap
 */
export class QwenBridge extends BaseBridge {
  readonly serviceId = 'qwen'
  private requestId = 0

  async initialize(): Promise<void> {
    if (!this.view) {
      throw new Error('QwenBridge: No view attached')
    }

    // Wait for the chat editor to appear
    await this.waitForElement('[contenteditable="true"]', 15000)

    // Inject the bridge script (only for response observation)
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
    if (!this.view) throw new Error('No view')

    const webContents = this.view.webContents

    // Focus the editor
    await this.executeScript(`
      (() => {
        const editor = document.querySelector('[contenteditable="true"]');
        if (editor) { editor.focus(); editor.innerHTML = ''; }
      })()
    `)

    await new Promise(r => setTimeout(r, 200))

    // Use Electron's native input event to type each character
    // This simulates real keyboard input that frameworks can detect
    for (const char of text) {
      webContents.sendInputEvent({
        type: 'keyDown',
        keyCode: char
      })
      webContents.sendInputEvent({
        type: 'char',
        keyCode: char
      })
      webContents.sendInputEvent({
        type: 'keyUp',
        keyCode: char
      })
      // Small delay between characters to not overwhelm
      await new Promise(r => setTimeout(r, 10))
    }

    // Wait for the framework to process and enable send button
    await new Promise(r => setTimeout(r, 500))

    // Press Enter to send
    webContents.sendInputEvent({
      type: 'keyDown',
      keyCode: 'Return'
    })
    webContents.sendInputEvent({
      type: 'char',
      keyCode: '\r'
    })
    webContents.sendInputEvent({
      type: 'keyUp',
      keyCode: 'Return'
    })

    // Start observing for response via injected script
    await this.executeScript(`
      window.__onechat_bridge.observeResponse(${reqId});
    `)
  }

  private async injectBridgeScript(): Promise<void> {
    const script = `
      (() => {
        if (window.__onechat_bridge) return;

        const ipcRenderer = window.ipcRenderer;

        window.__onechat_bridge = {
          observeResponse(reqId) {
            let lastText = '';
            let idleTimer = null;
            let settled = false;

            console.log('[OneChat] Qwen observing for response');

            const getAssistantText = () => {
              // Qwen uses: div.chat-answers-card-wrap for AI responses
              const answers = document.querySelectorAll('.chat-answers-card-wrap');
              if (answers.length === 0) {
                const cards = document.querySelectorAll('.answer-common-card');
                if (cards.length === 0) return '';
                const last = cards[cards.length - 1];
                return last.innerText || '';
              }
              const lastAnswer = answers[answers.length - 1];
              return lastAnswer.innerText || lastAnswer.textContent || '';
            };

            // Use polling since Qwen may do route navigation
            const pollInterval = setInterval(() => {
              if (settled) { clearInterval(pollInterval); return; }

              const currentText = getAssistantText();
              if (currentText && currentText !== lastText) {
                const newChunk = currentText.slice(lastText.length);
                if (newChunk) {
                  ipcRenderer.send('qwen-stream-chunk-' + reqId, newChunk);
                }
                lastText = currentText;

                if (idleTimer) clearTimeout(idleTimer);
                idleTimer = setTimeout(() => {
                  const finalText = getAssistantText();
                  if (finalText && finalText !== lastText) {
                    ipcRenderer.send('qwen-stream-chunk-' + reqId, finalText.slice(lastText.length));
                  }
                  settled = true;
                  clearInterval(pollInterval);
                  ipcRenderer.send('qwen-stream-done-' + reqId);
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
                  ipcRenderer.send('qwen-stream-done-' + reqId);
                } else {
                  ipcRenderer.send('qwen-stream-error-' + reqId, 'Response timeout');
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
