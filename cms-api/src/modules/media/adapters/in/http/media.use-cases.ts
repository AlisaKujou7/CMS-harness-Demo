import type {
  DeleteMediaUseCase,
  FinalizeMediaUseCase,
  GetMediaUseCase,
  ListMediaUseCase,
  PresignUploadUseCase,
  UpdateMediaUseCase,
} from '../../../application/ports/in/media.ports.js';

export const MEDIA_USE_CASES = Symbol('MediaUseCases');

export interface MediaUseCases {
  readonly presign: PresignUploadUseCase;
  readonly finalize: FinalizeMediaUseCase;
  readonly update: UpdateMediaUseCase;
  readonly remove: DeleteMediaUseCase;
  readonly get: GetMediaUseCase;
  readonly list: ListMediaUseCase;
}
