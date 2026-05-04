import { FastifyInstance } from 'fastify'
import { serviceManager } from '../../services'

export async function modelsRoute(fastify: FastifyInstance) {
  fastify.get('/v1/models', async () => {
    const services = serviceManager.getServices()

    const models = services.map((service) => ({
      id: service.id,
      object: 'model' as const,
      created: Math.floor(Date.now() / 1000),
      owned_by: 'onechat',
      permission: [],
      root: service.id,
      parent: null
    }))

    return {
      object: 'list',
      data: models
    }
  })
}
