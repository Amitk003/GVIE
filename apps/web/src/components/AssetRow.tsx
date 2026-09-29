/**
 * One row in the project list.
 *
 * We show the status the server gave us. We never upgrade it in the browser, and
 * a file that failed its seal is never shown as good, whatever the search said.
 */

import type { AssetSummary } from '../lib/api';

export function statusTone(status: string | null): 'good' | 'warn' | 'bad' {
  if (status === 'Verified') return 'good';
  if (status === 'Failed_C2PA') return 'bad';
  return 'warn';
}

export function statusLabel(status: string | null): string {
  if (status === null || status === '') return 'Status not known yet';
  return status.replace(/_/g, ' ');
}

export function AssetRow({ asset }: { asset: AssetSummary }) {
  const tone = statusTone(asset.veriStatus);
  return (
    <li
      data-testid="asset-row"
      style={{
        display: 'grid',
        gridTemplateColumns: '96px 1fr auto',
        gap: '14px',
        alignItems: 'center',
        padding: '12px 0',
        borderBottom: '1px solid #e6e6e6',
      }}
    >
      <img
        src={asset.thumbUrl}
        alt={`Proof photo for ${asset.publicId}`}
        width={96}
        height={72}
        style={{ objectFit: 'cover', borderRadius: '8px', background: '#eee' }}
      />
      <div>
        <div style={{ fontWeight: 600 }}>{asset.publicId}</div>
        <div style={{ fontSize: '13px', color: '#4a4a4a' }}>
          {asset.objCount === null ? 'no count yet' : `${asset.objCount} counted`}
          {asset.ndviDelta === null ? '' : `, plant change ${asset.ndviDelta.toFixed(2)}`}
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <span
          data-testid="asset-status"
          data-tone={tone}
          style={{
            display: 'inline-block',
            padding: '4px 10px',
            borderRadius: '999px',
            fontSize: '12px',
            border: '1px solid #cccccc',
          }}
        >
          {statusLabel(asset.veriStatus)}
        </span>
        {asset.compareUrl ? (
          <a
            href={asset.compareUrl}
            style={{ display: 'block', marginTop: '6px', fontSize: '12px' }}
          >
            see before and after
          </a>
        ) : null}
      </div>
    </li>
  );
}
