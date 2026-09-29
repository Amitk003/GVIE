import type { Metadata } from 'next';
import { ProjectSummary } from '../../../components/ProjectSummary';
import { readApiBase, searchAssets, type AssetSummary } from '../../../lib/api';

export const metadata: Metadata = {
  title: 'GVIE: project proof',
};

export const dynamic = 'force-dynamic';

/**
 * The reviewer page for one project.
 *
 * If the API cannot be reached we show an empty project and say why, instead of
 * a broken page. A reviewer must never see a clean looking screen that is
 * quietly showing nothing.
 */
export default async function ProjectPage({
  searchParams,
}: {
  searchParams: Promise<{ proj_id?: string }>;
}) {
  const params = await searchParams;
  const projId = params.proj_id ?? '';
  const apiBase = readApiBase();

  let assets: AssetSummary[] = [];
  let problem: string | null = null;
  try {
    assets = await searchAssets(apiBase, { projId, max: 50 });
  } catch (error) {
    problem = error instanceof Error ? error.message : 'we could not reach the api';
  }

  return (
    <main style={{ padding: '24px', maxWidth: '900px', margin: '0 auto' }}>
      {problem ? (
        <p data-testid="api-problem" style={{ color: '#a52020' }}>
          {problem}
        </p>
      ) : null}
      <ProjectSummary assets={assets} />
    </main>
  );
}
