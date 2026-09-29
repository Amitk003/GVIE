import { describe, expect, it } from 'vitest';
import { assetFolder, readApiConfig, requireWebhookSecret } from './config.js';

const baseEnv = {
  CLOUDINARY_CLOUD_NAME: 'impact-cloud',
  CLOUDINARY_API_KEY: 'key',
  CLOUDINARY_API_SECRET: 'secret',
};

describe('api config', () => {
  it('applies safe defaults', () => {
    const config = readApiConfig(baseEnv);
    expect(config.API_PORT).toBe(4000);
    expect(config.API_HOST).toBe('0.0.0.0');
    expect(config.CLOUDINARY_UPLOAD_PRESET).toBe('gvie_signed');
    expect(config.BASELINE_RADIUS_KM).toBe(2);
    expect(config.NODE_ENV).toBe('development');
  });

  it('reads numbers from text env', () => {
    const config = readApiConfig({ ...baseEnv, API_PORT: '4100', BASELINE_RADIUS_KM: '5' });
    expect(config.API_PORT).toBe(4100);
    expect(config.BASELINE_RADIUS_KM).toBe(5);
  });

  it('fails when cloud keys are missing', () => {
    expect(() => readApiConfig({})).toThrow('bad api env');
  });

  it('rejects bad port', () => {
    expect(() => readApiConfig({ ...baseEnv, API_PORT: '0' })).toThrow('bad api env');
  });

  it('needs webhook secret only when asked', () => {
    const config = readApiConfig(baseEnv);
    expect(() => requireWebhookSecret(config)).toThrow('missing CLOUDINARY_WEBHOOK_SECRET');
    const withSecret = readApiConfig({ ...baseEnv, CLOUDINARY_WEBHOOK_SECRET: 'hook' });
    expect(requireWebhookSecret(withSecret)).toBe('hook');
  });

  it('builds a project folder path', () => {
    expect(assetFolder({ CLOUDINARY_FOLDER_ROOT: 'gvie' }, 'WATER-01')).toBe('gvie/WATER-01');
  });
});
