import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { publicIdSchema } from '@gvie/schemas';
import type { RouteDeps } from '../deps.js';
import { parseInput } from '../http/route.js';
import { buildAnalyzeRequest, parseSector } from '../services/analyze-request.js';

export const telemetryRunSchema = z.object({
  public_id: publicIdSchema,
  sector: z.string().min(1).max(32),
  image_url: z.string().url().optional(),
  extra_instruction: z.string().min(1).max(300).optional(),
});

export async function telemetryRoutes(app: FastifyInstance, deps: RouteDeps): Promise<void> {
  app.post('/v1/telemetry/run', async (request, reply) => {
    const payload = parseInput(telemetryRunSchema, request, reply);
    if (!payload) return;

    const sector = parseSector(payload.sector);
    if (!sector) {
      return reply.code(400).send({
        error: 'unknown sector',
        details: ['sector must be water, forest or solar'],
      });
    }

    const imageUrl =
      payload.image_url ??
      `https://res.cloudinary.com/${deps.cloud.cloudName}/image/upload/${payload.public_id}`;
    const plan = buildAnalyzeRequest({
      cloudName: deps.cloud.cloudName,
      sector,
      imageUrl,
      extraInstruction: payload.extra_instruction,
    });

    await deps.queue.publish('telemetry', {
      publicId: payload.public_id,
      sector,
      imageUrl,
    });

    if (deps.runAnalyze) {
      const outcome = await deps.runAnalyze({
        publicId: payload.public_id,
        sector,
        imageUrl,
      });
      return reply.code(outcome.ok ? 202 : 502).send({
        accepted: outcome.ok,
        sector,
        publicId: payload.public_id,
        request: plan,
        reason: outcome.reason,
      });
    }

    return reply.code(202).send({
      accepted: true,
      sector,
      publicId: payload.public_id,
      request: plan,
    });
  });
}
