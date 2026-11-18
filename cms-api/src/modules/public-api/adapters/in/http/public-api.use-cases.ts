import type {
  GetPublicMediaUseCase,
  GetPublishedContentUseCase,
  ListPublishedContentUseCase,
} from '../../../application/ports/in/public-api.ports.js';

export const PUBLIC_API_USE_CASES = Symbol('PublicApiUseCases');

export interface PublicApiUseCases {
  readonly list: ListPublishedContentUseCase;
  readonly get: GetPublishedContentUseCase;
  readonly media: GetPublicMediaUseCase;
}
