import type { CloudinaryEnv } from '@gvie/cloudinary';
import type { ApiConfig } from './config.js';
import type { QueueWithHandlers } from './queue/job-queue.js';

export type AnalyzeRunner = (input: {
  publicId: string;
  sector: string;
  imageUrl: string;
}) => Promise<{ ok: boolean; reason?: string }>;

export type AssetSearch = (expression: string, maxResults: number) => Promise<unknown[]>;

export type AppDeps = {
  config: ApiConfig;
  cloud: CloudinaryEnv;
  queue: QueueWithHandlers;
  searchAssets?: AssetSearch;
  runAnalyze?: AnalyzeRunner;
  now?: () => Date;
};

export type RouteDeps = AppDeps;
