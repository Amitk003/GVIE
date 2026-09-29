import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { RouteDeps } from '../deps.js';
import { parseInput } from '../http/route.js';
import { buildProofManifest } from '../services/proof-pack.js';

export const proofExportSchema = z.object({
  title: z.string().min(1).max(120),
  place: z.string().min(1).max(120),
  assets: z
    .array(
      z.object({
        public_id: z.string().min(1).max(255),
        aligned_id: z.string().min(1).max(255).nullish(),
        sha256: z.string().length(64).nullish(),
        veri_status: z.string().max(32).nullish(),
        obj_count: z.number().int().min(0).nullish(),
        ndvi_delta: z.number().gt(-1).lt(1).nullish(),
      }),
    )
    .min(1)
    .max(200),
  video_scene_ids: z.array(z.string().min(1).max(255)).max(50).optional(),
});

export async function exportRoutes(app: FastifyInstance, deps: RouteDeps): Promise<void> {
  app.post('/v1/exports/proof', async (request, reply) => {
    const payload = parseInput(proofExportSchema, request, reply);
    if (!payload) return;

    const manifest = buildProofManifest({
      cloudName: deps.cloud.cloudName,
      title: payload.title,
      place: payload.place,
      assets: payload.assets.map((asset) => ({
        publicId: asset.public_id,
        alignedId: asset.aligned_id ?? null,
        sha256: asset.sha256 ?? null,
        veriStatus: asset.veri_status ?? null,
        objCount: asset.obj_count ?? null,
        ndviDelta: asset.ndvi_delta ?? null,
      })),
      videoSceneIds: payload.video_scene_ids,
      now: deps.now ? deps.now() : new Date(),
    });

    return reply.code(201).send({ manifest });
  });
}
