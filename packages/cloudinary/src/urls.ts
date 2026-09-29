function overlayId(publicId: string): string {
  return publicId.replaceAll('/', ':');
}

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
  const overlay = overlayId(input.alignedId);
  return (
    `https://res.cloudinary.com/${input.cloudName}/image/upload/` +
    `w_${width},c_fill,q_auto,f_auto/${input.baselineId}/` +
    `l_${overlay},w_${half},c_fill,g_east`
  );
}

export function animatedWipeUrl(input: {
  cloudName: string;
  baselineId: string;
  width?: number;
}): string {
  const width = input.width ?? 800;
  return (
    `https://res.cloudinary.com/${input.cloudName}/image/upload/` +
    `w_${width},c_fill,q_auto,f_gif,vs_30,dl_20/${input.baselineId}`
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
  const parts: string[] = [
    'q_auto,f_mp4',
    `l_text:Arial_40:${encodeText(input.title)},g_north,y_20`,
  ];
  for (const scene of rest) {
    parts.push(`l_video:${overlayId(scene)},fl_splice`);
  }
  parts.push(`l_text:Arial_28:${encodeText(input.place)},g_south,y_20`);
  return `https://res.cloudinary.com/${input.cloudName}/video/upload/${parts.join('/')}/${first}`;
}
