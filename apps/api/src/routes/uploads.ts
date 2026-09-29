import type { FastifyInstance } from 'fastify';
import { signUploadParams } from '@gvie/cloudinary';
import type { RouteDeps } from '../deps.js';
import { parseInput } from '../http/route.js';
import { buildUploadPlan, uploadSignInputSchema } from '../services/upload-plan.js';

export async function uploadRoutes(app: FastifyInstance, deps: RouteDeps): Promise<void> {
  app.post('/v1/uploads/sign', async (request, reply) => {
    const payload = parseInput(uploadSignInputSchema, request, reply);
    if (!payload) return;

    const now = deps.now ? deps.now() : new Date();
    const plan = buildUploadPlan({ config: deps.config, payload, now });
    const timestamp = Math.floor(now.getTime() / 1000);
    const signature = signUploadParams({ ...plan.params, timestamp }, deps.cloud.apiSecret);

    return reply.code(201).send({
      cloudName: deps.cloud.cloudName,
      apiKey: deps.cloud.apiKey,
      timestamp,
      signature,
      uploadUrl: `https://api.cloudinary.com/v1_1/${deps.cloud.cloudName}/image/upload`,
      publicId: plan.publicId,
      folder: plan.folder,
      params: plan.params,
      metadata: plan.metadata,
    });
  });
}
