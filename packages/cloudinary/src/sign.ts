import { createHash, createHmac } from 'node:crypto';

function toSignString(params: Record<string, string | number>): string {
  return Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');
}

export function signUploadParams(
  params: Record<string, string | number>,
  apiSecret: string,
): string {
  const text = toSignString(params);
  return createHash('sha1')
    .update(text + apiSecret)
    .digest('hex');
}

export function buildSignedUploadFields(input: {
  apiSecret: string;
  timestamp: number;
  folder: string;
  publicId: string;
  uploadPreset: string;
}): { timestamp: number; signature: string } {
  const params = {
    folder: input.folder,
    public_id: input.publicId,
    timestamp: input.timestamp,
    upload_preset: input.uploadPreset,
  };
  return { timestamp: input.timestamp, signature: signUploadParams(params, input.apiSecret) };
}

export function verifyWebhookSignature(input: {
  body: string;
  timestamp: string;
  signature: string;
  apiSecret: string;
}): boolean {
  const expected = createHmac('sha256', input.apiSecret)
    .update(`${input.timestamp}.${input.body}`)
    .digest('hex');
  if (expected.length !== input.signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) {
    diff |= expected.charCodeAt(i) ^ input.signature.charCodeAt(i);
  }
  return diff === 0;
}
