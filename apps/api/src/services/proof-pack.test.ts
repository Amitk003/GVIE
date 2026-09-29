import { describe, expect, it } from 'vitest';
import { buildProofManifest, hasAnyHash } from './proof-pack.js';

const fixedNow = new Date('2026-09-29T10:20:30.000Z');

describe('proof pack', () => {
  it('builds thumbs and compare links', () => {
    const manifest = buildProofManifest({
      cloudName: 'impact-cloud',
      title: 'Water done',
      place: 'Block A',
      now: fixedNow,
      assets: [
        {
          publicId: 'gvie/WATER-01/before_1',
          alignedId: 'gvie/WATER-01/aligned_1',
          sha256: 'a'.repeat(64),
          veriStatus: 'Verified',
          objCount: 3,
        },
      ],
    });
    expect(manifest.assetCount).toBe(1);
    expect(manifest.assets[0].thumbUrl).toContain('res.cloudinary.com/impact-cloud');
    expect(manifest.assets[0].compareUrl).toContain('l_gvie:WATER-01:aligned_1');
    expect(manifest.reelUrl).toBeNull();
    expect(hasAnyHash(manifest)).toBe(true);
    expect(manifest.generatedAt).toBe(fixedNow.toISOString());
  });

  it('has no compare link without an aligned asset', () => {
    const manifest = buildProofManifest({
      cloudName: 'c',
      title: 'T',
      place: 'P',
      assets: [{ publicId: 'a/b' }],
    });
    expect(manifest.assets[0].compareUrl).toBeNull();
    expect(hasAnyHash(manifest)).toBe(false);
  });

  it('adds a reel url when scenes are given', () => {
    const manifest = buildProofManifest({
      cloudName: 'c',
      title: 'T',
      place: 'P',
      assets: [{ publicId: 'a/b' }],
      videoSceneIds: ['v/one', 'v/two'],
    });
    expect(manifest.reelUrl).toContain('fl_splice');
    expect(manifest.reelUrl).toContain('l_video:v:two');
  });

  it('rejects an empty asset list', () => {
    expect(() =>
      buildProofManifest({ cloudName: 'c', title: 'T', place: 'P', assets: [] }),
    ).toThrow('need at least one asset');
  });
});
