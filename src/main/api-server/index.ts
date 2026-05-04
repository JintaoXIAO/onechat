import Fastify from 'fastify'
import { chatCompletionsRoute } from './routes/chat-completions'
import { modelsRoute } from './routes/models'

const DEFAULT_PORT = 11434
const DEFAULT_HOST = '127.0.0.1'

export async function startApiServer(port = DEFAULT_PORT, host = DEFAULT_HOST) {
  const fastify = Fastify({
    logger: false
  })

  // CORS support for local tools
  fastify.addHook('onRequest', async (request, reply) => {
    reply.header('Access-Control-Allow-Origin', '*')
    reply.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')

    if (request.method === 'OPTIONS') {
      reply.status(204).send()
    }
  })

  // Register routes
  fastify.register(chatCompletionsRoute)
  fastify.register(modelsRoute)

  // Health check
  fastify.get('/health', async () => {
    return { status: 'ok', timestamp: Date.now() }
  })

  try {
    await fastify.listen({ port, host })
    console.log(`[OneChat API] Server running at http://${host}:${port}`)
    return fastify
  } catch (err) {
    console.error('[OneChat API] Failed to start server:', err)
    throw err
  }
}
