import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { readCloudinaryEnv } from './config.js';
import { thumbUrl, impactReelUrl, splitCompareUrl } from './urls.js';
import { buildSignedUploadFields, verifyWebhookSignature } from './sign.js';

describe('cloudinary config', () => {
  it('fails fast on missing keys', () => {
    expect(() => readCloudinaryEnv({})).toThrow('missing CLOUDINARY_CLOUD_NAME');
  });
});

describe('upload sign', () => {
  it('builds stable sha1 signature', () => {
    const out = buildSignedUploadFields({
      apiSecret: 'secret123',
      timestamp: 1720000000,
      folder: 'gvie/water',
      publicId: 'borehole_001',
      uploadPreset: 'gvie_signed',
    });
    expect(out.signature).toMatch(/^[a-f0-9]{40}$/);
  });

  it('verifies webhook hmac', () => {
    const secret = 'hooksecret';
    const body = '{"public_id":"a"}';
    const timestamp = '1720000001';
    const signature = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
    expect(verifyWebhookSignature({ body, timestamp, signature, apiSecret: secret })).toBe(true);
    expect(
      verifyWebhookSignature({ body, timestamp, signature: 'bad', apiSecret: secret }),
    ).toBe(false);
  });
});

describe('urls', () => {
  it('builds thumb and compare links', () => {
    const thumb = thumbUrl('gvie/base_001', 'demo', 400);
    expect(thumb).toContain('res.cloudinary.com/demo');
    const split = splitCompareUrl({
      cloudName: 'demo',
      baselineId: 'gvie/base_001',
      alignedId: 'gvie/aligned_001',
    });
    expect(split).toContain('l_gvie:aligned_001');
    const reel = impactReelUrl({
      cloudName: 'demo',
      sceneIds: ['gvie/s1', 'gvie/s2'],
      title: 'Water done',
      place: 'Block A',
    });
    expect(reel).toContain('fl_splice');
  });
});
