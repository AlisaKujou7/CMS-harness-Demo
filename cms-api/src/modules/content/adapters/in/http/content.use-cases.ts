import type {
  ContentActionUseCase,
  ContentCategoriesUseCase,
  ContentStatsUseCase,
  CreateContentUseCase,
  DeleteContentUseCase,
  GetContentUseCase,
  GetContentVersionUseCase,
  ListContentUseCase,
  ListContentVersionsUseCase,
  RejectContentUseCase,
  RevertContentUseCase,
  ScheduleContentUseCase,
  UpdateContentUseCase,
} from '../../../application/ports/in/content.ports.js';

export const CONTENT_USE_CASES = Symbol('ContentUseCases');

export interface ContentUseCases {
  readonly create: CreateContentUseCase;
  readonly update: UpdateContentUseCase;
  readonly get: GetContentUseCase;
  readonly list: ListContentUseCase;
  readonly stats: ContentStatsUseCase;
  readonly categories: ContentCategoriesUseCase;
  readonly submit: ContentActionUseCase;
  readonly publish: ContentActionUseCase;
  readonly reject: RejectContentUseCase;
  readonly unpublish: ContentActionUseCase;
  readonly archive: ContentActionUseCase;
  readonly schedule: ScheduleContentUseCase;
  readonly remove: DeleteContentUseCase;
  readonly versions: ListContentVersionsUseCase;
  readonly version: GetContentVersionUseCase;
  readonly revert: RevertContentUseCase;
}
