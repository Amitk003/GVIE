import { describe, expect, it } from 'vitest';
import { buildAnalyzeRequest, analyzeEndpointUrl, parseSector } from './analyze-request.js';
import { buildProofManifest, hasAnyHash } from './proof-pack.js';

const fixedNow = new Date('2026-09-29T10:20:30.000Z');

describe('analyze request', () => {
  it('builds the v2 tagging url', () => {
    expect(analyzeEndpointUrl('impact-cloud')).toBe(
      'https://api.cloudinary.com/v2/analysis/impact-cloud/analyze/ai_vision_tagging',
    );
  });

  it('uses the sector schema and prompt', () => {
    const request = buildAnalyzeRequest({
      cloudName: 'impact-cloud',
      sector: 'water',
      imageUrl: 'https://res.cloudinary.com/impact-cloud/image/upload/v1/borehole.jpg',
    });
    expect(request.body.source.uri).toContain('borehole.jpg');
    expect(request.body.prompts).toHaveLength(1);
    expect(request.body.json_schema.required).toContain('operational_status');
    expect(request.body.json_schema.additionalProperties).toBe(false);
  });

  it('adds an extra instruction when asked', () => {
    const request = buildAnalyzeRequest({
      cloudName: 'c',
      sector: 'forest',
      imageUrl: 'u',
      extraInstruction: 'Focus on the left side.',
    });
    expect(request.body.prompts).toHaveLength(2);
    expect(request.body.json_schema.required).toContain('canopy_cover_pct');
  });

  it('reads sector names in any case', () => {
    expect(parseSector(' WATER ')).toBe('water');
    expect(parseSector('Solar')).toBe('solar');
    expect(parseSector('unknown')).toBeNull();
  });
});

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
