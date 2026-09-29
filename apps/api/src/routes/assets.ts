import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { publicIdSchema, tempoPhaseSchema, veriStatusSchema } from '@gvie/schemas';
import type { RouteDeps } from '../deps.js';
import { parseInput } from '../http/route.js';
import { searchByTextAndMeta } from '@gvie/cloudinary';

export const assetQuerySchema = z.object({
  proj_id: z.string().min(1).max(64).optional(),
  veri_status: veriStatusSchema.optional(),
  tempo_phase: tempoPhaseSchema.optional(),
  text: z.string().min(1).max(120).optional(),
  max: z.coerce.number().int().min(1).max(100).default(50),
});

export const assetParamsSchema = z.object({
  publicId: publicIdSchema,
});

export async function assetRoutes(app: FastifyInstance, deps: RouteDeps): Promise<void> {
  app.get('/v1/assets', async (request, reply) => {
    const query = parseInput(assetQuerySchema, request, reply, 'query');
    if (!query) return;

    const expression = searchByTextAndMeta({
      text: query.text,
      projId: query.proj_id,
      veriStatus: query.veri_status,
      tempoPhase: query.tempo_phase,
      maxResults: query.max,
    });

    if (!deps.searchAssets) {
      return reply.code(503).send({
        error: 'search not configured',
        details: ['supply the searchAssets dependency'],
      });
    }

    const results = await deps.searchAssets(expression, query.max);
    return reply.send({ expression, count: results.length, results });
  });

  app.get('/v1/assets/:publicId', async (request, reply) => {
    const params = parseInput(assetParamsSchema, request, reply, 'params');
    if (!params) return;
    const expression = `public_id="${params.publicId}"`;
    const results = deps.searchAssets ? await deps.searchAssets(expression, 1) : [];
    if (results.length === 0) {
      return reply.code(404).send({ error: 'asset not found', details: [] });
    }
    return reply.send({ asset: results[0] });
  });
}

