import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  API_HOST: z.string().min(1).default('0.0.0.0'),
  CLOUDINARY_CLOUD_NAME: z.string().min(1),
  CLOUDINARY_API_KEY: z.string().min(1),
  CLOUDINARY_API_SECRET: z.string().min(1),
  CLOUDINARY_UPLOAD_PRESET: z.string().min(1).default('gvie_signed'),
  CLOUDINARY_FOLDER_ROOT: z.string().min(1).default('gvie'),
  CLOUDINARY_WEBHOOK_SECRET: z.string().min(1).optional(),
  BASELINE_RADIUS_KM: z.coerce.number().min(0.1).max(50).default(2),
  BASELINE_MAX_RESULTS: z.coerce.number().int().min(1).max(100).default(10),
});

export type ApiConfig = z.infer<typeof envSchema>;

export function readApiConfig(input: NodeJS.ProcessEnv = process.env): ApiConfig {
  const parsed = envSchema.safeParse(input);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((issue) => {
      const key = issue.path.join('.') || 'env';
      return `${key}: ${issue.message}`;
    });
    throw new Error(`bad api env:\n${lines.join('\n')}`);
  }
  return parsed.data;
}

export function requireWebhookSecret(config: ApiConfig): string {
  const secret = config.CLOUDINARY_WEBHOOK_SECRET;
  if (!secret) throw new Error('missing CLOUDINARY_WEBHOOK_SECRET');
  return secret;
}

export function assetFolder(
  config: Pick<ApiConfig, 'CLOUDINARY_FOLDER_ROOT'>,
  projectId: string,
): string {
  return `${config.CLOUDINARY_FOLDER_ROOT}/${projectId}`;
}
