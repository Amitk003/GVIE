export type CloudinaryEnv = {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
};

export function readCloudinaryEnv(input: NodeJS.ProcessEnv = process.env): CloudinaryEnv {
  const cloudName = (input.CLOUDINARY_CLOUD_NAME ?? '').trim();
  const apiKey = (input.CLOUDINARY_API_KEY ?? '').trim();
  const apiSecret = (input.CLOUDINARY_API_SECRET ?? '').trim();
  if (!cloudName) throw new Error('missing CLOUDINARY_CLOUD_NAME');
  if (!apiKey) throw new Error('missing CLOUDINARY_API_KEY');
  if (!apiSecret) throw new Error('missing CLOUDINARY_API_SECRET');
  return { cloudName, apiKey, apiSecret };
}

export function uploadPresetName(input: NodeJS.ProcessEnv = process.env): string {
  return (input.CLOUDINARY_UPLOAD_PRESET ?? 'gvie_signed').trim() || 'gvie_signed';
}
