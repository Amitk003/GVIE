/**
 * The trust badge a field worker sees.
 *
 * The one thing this component must never do is say "Verified". Only the server
 * can say that, after it checks the seal on its own.
 */

export type TrustBadgeProps = {
  label: string;
  tone: 'good' | 'warn' | 'bad';
  detail: string;
};

const TONE_COLOR: Record<TrustBadgeProps['tone'], string> = {
  good: '#1b7f4d',
  warn: '#8a6100',
  bad: '#a52020',
};

export function TrustBadge({ label, tone, detail }: TrustBadgeProps) {
  return (
    <div
      role="status"
      data-testid="trust-badge"
      data-tone={tone}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '12px 14px',
        borderRadius: '10px',
        border: `1px solid ${TONE_COLOR[tone]}`,
        background: '#fff',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: '12px',
          height: '12px',
          borderRadius: '50%',
          background: TONE_COLOR[tone],
          flex: '0 0 auto',
        }}
      />
      <div>
        <strong style={{ display: 'block' }}>{label}</strong>
        <span style={{ fontSize: '13px', color: '#4a4a4a' }}>{detail}</span>
      </div>
    </div>
  );
}
