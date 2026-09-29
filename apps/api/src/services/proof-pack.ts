import { impactReelUrl, splitCompareUrl, thumbUrl } from '@gvie/cloudinary';

export type ProofAssetInput = {
  publicId: string;
  alignedId?: string | null;
  sha256?: string | null;
  veriStatus?: string | null;
  objCount?: number | null;
  ndviDelta?: number | null;
};

export type ProofManifest = {
  title: string;
  place: string;
  generatedAt: string;
  assetCount: number;
  assets: Array<{
    publicId: string;
    thumbUrl: string;
    compareUrl: string | null;
    sha256: string | null;
    veriStatus: string | null;
    objCount: number | null;
    ndviDelta: number | null;
  }>;
  reelUrl: string | null;
};

export function buildProofManifest(input: {
  cloudName: string;
  title: string;
  place: string;
  assets: ProofAssetInput[];
  videoSceneIds?: string[];
  now?: Date;
}): ProofManifest {
  if (input.assets.length === 0) throw new Error('need at least one asset');

  const assets = input.assets.map((asset) => ({
    publicId: asset.publicId,
    thumbUrl: thumbUrl(asset.publicId, input.cloudName),
    compareUrl: asset.alignedId
      ? splitCompareUrl({
          cloudName: input.cloudName,
          baselineId: asset.publicId,
          alignedId: asset.alignedId,
        })
      : null,
    sha256: asset.sha256 ?? null,
    veriStatus: asset.veriStatus ?? null,
    objCount: asset.objCount ?? null,
    ndviDelta: asset.ndviDelta ?? null,
  }));

  const scenes = input.videoSceneIds ?? [];
  const reelUrl =
    scenes.length > 0
      ? impactReelUrl({
          cloudName: input.cloudName,
          sceneIds: scenes,
          title: input.title,
          place: input.place,
        })
      : null;

  return {
    title: input.title,
    place: input.place,
    generatedAt: (input.now ?? new Date()).toISOString(),
    assetCount: assets.length,
    assets,
    reelUrl,
  };
}

export function hasAnyHash(manifest: ProofManifest): boolean {
  return manifest.assets.some((asset) => asset.sha256 !== null);
}
