import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AssetRow, statusLabel, statusTone } from './AssetRow';
import { TrustBadge } from './TrustBadge';

const asset = {
  publicId: 'gvie/WATER-01/after_1',
  thumbUrl: 'https://res.cloudinary.com/demo/image/upload/a.jpg',
  compareUrl: 'https://res.cloudinary.com/demo/image/upload/split.jpg',
  veriStatus: 'Verified',
  objCount: 3,
  ndviDelta: 0.22,
  sha256: 'a'.repeat(64),
};

describe('trust badge', () => {
  it('shows the label and the detail', () => {
    render(<TrustBadge label="Seal looks good" tone="good" detail="server checks it later" />);
    expect(screen.getByText('Seal looks good')).toBeDefined();
    expect(screen.getByText('server checks it later')).toBeDefined();
  });

  it('carries the tone for styling', () => {
    render(<TrustBadge label="No valid seal" tone="bad" detail="no manifest" />);
    expect(screen.getByTestId('trust-badge').dataset.tone).toBe('bad');
  });
});

describe('status tone', () => {
  it('is green only for verified', () => {
    expect(statusTone('Verified')).toBe('good');
  });

  it('is red for a failed seal', () => {
    expect(statusTone('Failed_C2PA')).toBe('bad');
  });

  it('is amber for everything else', () => {
    expect(statusTone('Pending_AI')).toBe('warn');
    expect(statusTone('Flagged_Location')).toBe('warn');
    expect(statusTone(null)).toBe('warn');
  });
});

describe('status label', () => {
  it('speaks plain words', () => {
    expect(statusLabel('Failed_C2PA')).toBe('Failed C2PA');
  });

  it('says so when there is no status', () => {
    expect(statusLabel(null)).toContain('not known');
  });
});
