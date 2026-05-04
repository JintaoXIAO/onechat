import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { serviceManager } from '../../services'
import { ChatMessage } from '../../bridges'

interface ChatCompletionRequest {
  model: string
  messages: ChatMessage[]
  stream?: boolean
  temperature?: number
  max_tokens?: number
}

export async function chatCompletionsRoute(fastify: FastifyInstance) {
  fastify.post(
    '/v1/chat/completions',
    async (request: FastifyRequest<{ Body: ChatCompletionRequest }>, reply: FastifyReply) => {
      const { model, messages, stream = false } = request.body

      if (!model || !messages || messages.length === 0) {
        reply.status(400).send({
          error: {
            message: 'model and messages are required',
            type: 'invalid_request_error'
          }
        })
        return
      }

      // Find the bridge for the requested model
      const bridge = serviceManager.getBridge(model)
      if (!bridge) {
        reply.status(404).send({
          error: {
            message: `Model '${model}' not found or not ready. Available models: ${serviceManager
              .getServices()
              .map((s) => s.id)
              .join(', ')}`,
            type: 'invalid_request_error'
          }
        })
        return
      }

      if (!bridge.isReady()) {
        reply.status(503).send({
          error: {
            message: `Model '${model}' is not ready yet. Please wait for the service to load.`,
            type: 'service_unavailable'
          }
        })
        return
      }

      const requestId = `chatcmpl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

      if (stream) {
        return handleStreamResponse(reply, bridge, messages, model, requestId)
      } else {
        return handleNonStreamResponse(reply, bridge, messages, model, requestId)
      }
    }
  )
}

async function handleStreamResponse(
  reply: FastifyReply,
  bridge: { sendMessage(messages: ChatMessage[]): AsyncIterable<string> },
  messages: ChatMessage[],
  model: string,
  requestId: string
) {
  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  })

  try {
    for await (const chunk of bridge.sendMessage(messages)) {
      const data = {
        id: requestId,
        object: 'chat.completion.chunk',
        created: Math.floor(Date.now() / 1000),
        model,
        choices: [
          {
            index: 0,
            delta: { content: chunk },
            finish_reason: null
          }
        ]
      }
      reply.raw.write(`data: ${JSON.stringify(data)}\n\n`)
    }

    // Send final chunk with finish_reason
    const finalData = {
      id: requestId,
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [
        {
          index: 0,
          delta: {},
          finish_reason: 'stop'
        }
      ]
    }
    reply.raw.write(`data: ${JSON.stringify(finalData)}\n\n`)
    reply.raw.write('data: [DONE]\n\n')
  } catch (err) {
    const errorData = {
      error: {
        message: err instanceof Error ? err.message : 'Unknown error',
        type: 'server_error'
      }
    }
    reply.raw.write(`data: ${JSON.stringify(errorData)}\n\n`)
  } finally {
    reply.raw.end()
  }
}

async function handleNonStreamResponse(
  reply: FastifyReply,
  bridge: { sendMessage(messages: ChatMessage[]): AsyncIterable<string> },
  messages: ChatMessage[],
  model: string,
  requestId: string
) {
  try {
    let fullContent = ''
    for await (const chunk of bridge.sendMessage(messages)) {
      fullContent += chunk
    }

    return {
      id: requestId,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: fullContent
          },
          finish_reason: 'stop'
        }
      ],
      usage: {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0
      }
    }
  } catch (err) {
    reply.status(500).send({
      error: {
        message: err instanceof Error ? err.message : 'Unknown error',
        type: 'server_error'
      }
    })
  }
}
