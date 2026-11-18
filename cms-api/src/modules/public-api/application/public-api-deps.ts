import type { Clock } from '../../../shared/ports/system.port.js';
import type {
  PublicMediaReader,
  PublishedContentReader,
  ResponseCache,
} from './ports/out/public-sources.port.js';

export interface PublicApiConfig {
  readonly cacheTtlSeconds: number;
  // How often a response that holds signed URLs must change, so it is never reused past them.
  readonly urlRefreshSeconds: number;
}

export interface PublicApiDeps {
  readonly content: PublishedContentReader;
  readonly mediaReader: PublicMediaReader;
  readonly responseCache: ResponseCache;
  readonly clock: Clock;
  readonly publicApiConfig: PublicApiConfig;
}
