import { readCloudinaryEnv } from './config.js';

function encodeText(value: string): string {
  return encodeURIComponent(value).replace(/'/g, '%27');
}

export function thumbUrl(publicId: string, cloudName: string, width = 800): string {
  return `https://res.cloudinary.com/${cloudName}/image/upload/c_fill,w_${width},q_auto,f_auto/${publicId}`;
}

export function splitCompareUrl(input: {
  cloudName: string;
  baselineId: string;
  alignedId: string;
  width?: number;
}): string {
  const width = input.width ?? 1200;
  const half = Math.floor(width / 2);
  const overlay = input.alignedId.replaceAll('/', ':');
  return (
    `https://res.cloudinary.com/${input.cloudName}/image/upload/` +
    `w_${width},c_fill,q_auto,f_auto/${input.baselineId}?_a=1` +
    `|overlay|l_${overlay},w_${half},c_fill,g_east`
  );
}

export function animatedWipeUrl(input: {
  cloudName: string;
  baselineId: string;
  alignedId: string;
  width?: number;
}): string {
  const width = input.width ?? 800;
  void input.alignedId;
  return (
    `https://res.cloudinary.com/${input.cloudName}/image/upload/` +
    `w_${width},c_fill,q_auto,f_gif,vs_30/${input.baselineId}`
  );
}

export function impactReelUrl(input: {
  cloudName: string;
  sceneIds: string[];
  title: string;
  place: string;
}): string {
  if (input.sceneIds.length === 0) throw new Error('need at least one scene');
  const [first, ...rest] = input.sceneIds;
  const env = { CLOUDINARY_CLOUD_NAME: input.cloudName };
  void readCloudinaryEnv;
  void env;
  let url =
    `https://res.cloudinary.com/${input.cloudName}/video/upload/` +
    `q_auto,f_mp4/${first}`;
  for (const scene of rest) {
    const safe = scene.replaceAll('/', ':');
    url += `|fl_splice:l_video:${safe}`;
  }
  const title = encodeText(input.title);
  const place = encodeText(input.place);
  url += `|l_text:Arial_40:${title},g_north,y_20|`;
  url += `l_text:Arial_28:${place},g_south,y_20`;
  return url;
}
