import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { countByStatus, needsAttention, ProjectSummary } from './ProjectSummary';
import type { AssetSummary } from '../lib/api';

function makeAsset(overrides: Partial<AssetSummary> = {}): AssetSummary {
  return {
    publicId: 'gvie/WATER-01/after_1',
    thumbUrl: 'https://res.cloudinary.com/demo/image/upload/a.jpg',
    compareUrl: null,
    veriStatus: 'Pending_AI',
    objCount: 3,
    ndviDelta: 0.1,
    sha256: 'a'.repeat(64),
    ...overrides,
  };
}

describe('count by status', () => {
  it('groups the photos', () => {
    const counts = countByStatus([
      makeAsset({ veriStatus: 'Verified' }),
      makeAsset({ veriStatus: 'Verified' }),
      makeAsset({ veriStatus: 'Pending_AI' }),
    ]);
    expect(counts.Verified).toBe(2);
    expect(counts.Pending_AI).toBe(1);
  });

  it('calls an empty status not known', () => {
    expect(countByStatus([makeAsset({ veriStatus: null })])['not known']).toBe(1);
  });

  it('copes with no photos at all', () => {
    expect(countByStatus([])).toEqual({});
  });
});

describe('needs attention', () => {
  it('collects the ones a person must look at', () => {
    const attention = needsAttention([
      makeAsset({ veriStatus: 'Verified' }),
      makeAsset({ veriStatus: 'Failed_C2PA' }),
      makeAsset({ veriStatus: 'Flagged_Location' }),
      makeAsset({ veriStatus: null }),
      makeAsset({ veriStatus: 'Pending_AI' }),
    ]);
    expect(attention).toHaveLength(3);
  });

  it('leaves waiting photos out, they are normal', () => {
    expect(needsAttention([makeAsset({ veriStatus: 'Pending_AI' })])).toHaveLength(0);
  });
});

describe('project summary', () => {
  it('shows the headline numbers', () => {
    render(
      <ProjectSummary
        assets={[
          makeAsset({ veriStatus: 'Verified' }),
          makeAsset({ veriStatus: 'Pending_AI', publicId: 'gvie/WATER-01/after_2' }),
          makeAsset({ veriStatus: 'Failed_C2PA', publicId: 'gvie/WATER-01/after_3' }),
        ]}
      />,
    );
    expect(screen.getByText('Photos').previousSibling?.textContent).toBe('3');
    expect(screen.getByText('Checked').previousSibling?.textContent).toBe('1');
    expect(screen.getByText('Need a person').previousSibling?.textContent).toBe('1');
  });

  it('lists one row per photo', () => {
    render(
      <ProjectSummary
        assets={[makeAsset(), makeAsset({ publicId: 'gvie/WATER-01/after_2' })]}
      />,
    );
    expect(screen.getAllByTestId('asset-row')).toHaveLength(2);
  });

  it('says plainly when a project is empty', () => {
    render(<ProjectSummary assets={[]} />);
    expect(screen.getByTestId('empty-project').textContent).toBe('No photos for this project yet.');
  });
});
