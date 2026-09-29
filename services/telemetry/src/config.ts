import { z } from 'zod';

const envSchema = z.object({
  CLOUDINARY_CLOUD_NAME: z.string().min(1),
  CLOUDINARY_API_KEY: z.string().min(1),
  CLOUDINARY_API_SECRET: z.string().min(1),
  TELEMETRY_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(5).default(2),
  TELEMETRY_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120000).default(30000),
  TELEMETRY_AUDIT_FOLDER: z.string().min(1).default('gvie/audit'),
});

export type TelemetryConfig = z.infer<typeof envSchema>;

export function readTelemetryConfig(input: NodeJS.ProcessEnv = process.env): TelemetryConfig {
  const parsed = envSchema.safeParse(input);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((issue) => {
      const key = issue.path.join('.') || 'env';
      return `${key}: ${issue.message}`;
    });
    throw new Error(`bad telemetry env:\n${lines.join('\n')}`);
  }
  return parsed.data;
}

export function basicAuthHeader(apiKey: string, apiSecret: string): string {
  return `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')}`;
}

export function analyzeUrl(cloudName: string): string {
  return `https://api.cloudinary.com/v2/analysis/${cloudName}/analyze/ai_vision_tagging`;
}

export function assetUrl(cloudName: string, publicId: string): string {
  return `https://res.cloudinary.com/${cloudName}/image/upload/${publicId}`;
}
