/**
 * What the reviewer sees for one project.
 *
 * Plain words: how many photos, how many are checked, how many still need a
 * person. The numbers come from the API, we never make them up here.
 */

import type { AssetSummary } from '../lib/api';
import { AssetRow } from './AssetRow';

export function countByStatus(assets: AssetSummary[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const asset of assets) {
    const key = asset.veriStatus ?? 'not known';
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

export function needsAttention(assets: AssetSummary[]): AssetSummary[] {
  return assets.filter((asset) => {
    if (asset.veriStatus === null) return true;
    if (asset.veriStatus === 'Failed_C2PA') return true;
    if (asset.veriStatus === 'Flagged_Location') return true;
    return false;
  });
}

export function ProjectSummary({ assets }: { assets: AssetSummary[] }) {
  const counts = countByStatus(assets);
  const attention = needsAttention(assets);

  return (
    <section style={{ display: 'grid', gap: '16px' }}>
      <h1 style={{ fontSize: '22px', margin: 0 }}>Project proof</h1>

      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
        <Stat label="Photos" value={assets.length} />
        <Stat label="Checked" value={counts.Verified ?? 0} />
        <Stat label="Waiting" value={counts.Pending_AI ?? 0} />
        <Stat label="Need a person" value={attention.length} />
      </div>

      {assets.length === 0 ? (
        <p data-testid="empty-project">No photos for this project yet.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {assets.map((asset) => (
            <AssetRow key={asset.publicId} asset={asset} />
          ))}
        </ul>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ border: '1px solid #e6e6e6', borderRadius: '10px', padding: '12px 18px' }}>
      <div style={{ fontSize: '22px', fontWeight: 700 }}>{value}</div>
      <div style={{ fontSize: '13px', color: '#4a4a4a' }}>{label}</div>
    </div>
  );
}
