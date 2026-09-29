import type { FastifyInstance } from 'fastify';
import { verifyWebhookSignature } from '@gvie/cloudinary';
import type { RouteDeps } from '../deps.js';
import { errorPayload } from '../http/route.js';
import { RequestError } from '../http/validation.js';
import { requireWebhookSecret } from '../config.js';
import {
  cloudinaryWebhookSchema,
  parseGeoCoords,
  parseUploadEvent,
  planJobsFromEvent,
} from '../services/webhook-event.js';

export async function webhookRoutes(app: FastifyInstance, deps: RouteDeps): Promise<void> {
  app.post('/v1/webhooks/cloudinary', async (request, reply) => {
    try {
      const body = request.body as unknown;
      const parsed = cloudinaryWebhookSchema.safeParse(body);
      if (!parsed.success) {
        throw new RequestError(400, 'bad webhook body');
      }

      const secret = requireWebhookSecret(deps.config);
      const signature = String(request.headers['x-cld-signature'] ?? '');
      const timestamp = String(request.headers['x-cld-timestamp'] ?? '');
      const raw = request.rawBody ?? JSON.stringify(body);
      const trusted = verifyWebhookSignature({
        body: raw,
        timestamp,
        signature,
        apiSecret: secret,
      });
      if (!trusted) {
        throw new RequestError(401, 'bad webhook signature');
      }

      const event = parseUploadEvent(parsed.data);
      const jobs = planJobsFromEvent(event);
      for (const name of jobs) {
        await deps.queue.publish(name, {
          publicId: event.publicId,
          resourceType: event.resourceType,
          projId: event.metadata.proj_id,
          tempoPhase: event.metadata.tempo_phase,
          baseAssetId: event.metadata.base_asset_id,
          sha256: event.sha256,
          c2paClaimed: event.c2paClaimed,
          exifGps: event.exifGps,
          geoCoords: parseGeoCoords(event.metadata.geo_coords),
        });
      }

      return reply.code(202).send({ accepted: true, publicId: event.publicId, jobs });
    } catch (error) {
      const { status, payload } = errorPayload(error);
      return reply.code(status).send(payload);
    }
  });
}
