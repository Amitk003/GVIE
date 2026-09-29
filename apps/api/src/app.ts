import Fastify, { type FastifyInstance } from 'fastify';
import type { AppDeps } from './deps.js';
import { errorPayload } from './http/route.js';
import { assetRoutes } from './routes/assets.js';
import { exportRoutes } from './routes/exports.js';
import { healthRoutes } from './routes/health.js';
import { telemetryRoutes } from './routes/telemetry.js';
import { uploadRoutes } from './routes/uploads.js';
import { webhookRoutes } from './routes/webhooks.js';

export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  const app = Fastify({
    logger: deps.config.NODE_ENV === 'test' ? false : { level: 'info' },
  });

  app.addContentTypeParser(
    'application/json',
    { parseAs: 'string' },
    (request, body, done) => {
      request.rawBody = body as string;
      try {
        done(null, body === '' ? {} : JSON.parse(body as string));
      } catch {
        done(new Error('bad json body'), undefined);
      }
    },
  );

  app.setErrorHandler((error, _request, reply) => {
    const { status, payload } = errorPayload(error);
    reply.code(status).send(payload);
  });

  app.setNotFoundHandler((_request, reply) => {
    reply.code(404).send({ error: 'route not found', details: [] });
  });

  await app.register(healthRoutes);
  await app.register(uploadRoutes, deps);
  await app.register(webhookRoutes, deps);
  await app.register(assetRoutes, deps);
  await app.register(telemetryRoutes, deps);
  await app.register(exportRoutes, deps);

  return app;
}
