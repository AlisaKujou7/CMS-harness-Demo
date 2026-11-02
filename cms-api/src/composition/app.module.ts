import { type DynamicModule, Module } from '@nestjs/common';
import { MediaController } from '../modules/media/adapters/in/http/media.controller.js';
import {
  MEDIA_USE_CASES,
  type MediaUseCases,
} from '../modules/media/adapters/in/http/media.use-cases.js';
import type { MediaDeps, MediaConfig } from '../modules/media/application/media-deps.js';
import type { MediaRepository } from '../modules/media/application/ports/out/media-repository.port.js';
import type {
  ImageProcessor,
  MediaVariantQueue,
  ObjectStorage,
  SvgSanitizer,
} from '../modules/media/application/ports/out/media-services.port.js';
import { FinalizeMedia } from '../modules/media/application/use-cases/finalize-media.use-case.js';
import {
  DeleteMedia,
  UpdateMedia,
} from '../modules/media/application/use-cases/manage-media.use-case.js';
import { PresignUpload } from '../modules/media/application/use-cases/presign-upload.use-case.js';
import { GetMedia, ListMedia } from '../modules/media/application/use-cases/read-media.use-case.js';
import type { MediaUploaded } from '../modules/media/domain/events/media.events.js';
import { contentDeps, mediaDeps } from './module-deps.js';
import { ContentController } from '../modules/content/adapters/in/http/content.controller.js';
import {
  CONTENT_USE_CASES,
  type ContentUseCases,
} from '../modules/content/adapters/in/http/content.use-cases.js';
import type { ContentRepository } from '../modules/content/application/ports/out/content-repository.port.js';
import type { ContentDeps } from '../modules/content/application/content-deps.js';
import { CreateContent } from '../modules/content/application/use-cases/create-content.use-case.js';
import {
  ArchiveContent,
  DeleteContent,
  PublishContent,
  RejectContent,
  ScheduleContent,
  SubmitContent,
  UnpublishContent,
} from '../modules/content/application/use-cases/lifecycle.use-case.js';
import {
  ContentCategories,
  ContentStats,
  GetContent,
  ListContent,
} from '../modules/content/application/use-cases/read-content.use-case.js';
import { UpdateContent } from '../modules/content/application/use-cases/update-content.use-case.js';
import {
  GetContentVersion,
  ListContentVersions,
  RevertContent,
} from '../modules/content/application/use-cases/versions.use-case.js';
import { AuditController } from '../modules/audit/adapters/in/http/audit.controller.js';
import {
  AUDIT_USE_CASES,
  type AuditUseCases,
} from '../modules/audit/adapters/in/http/audit.use-cases.js';
import type { AuditEventReader } from '../modules/audit/application/ports/out/audit-reader.port.js';
import { ExportAuditEvents } from '../modules/audit/application/use-cases/export-audit-events.use-case.js';
import { ListAuditEvents } from '../modules/audit/application/use-cases/list-audit-events.use-case.js';
import { ApiKeysController } from '../modules/auth/adapters/in/http/api-keys.controller.js';
import { AcceptInvitation } from '../modules/auth/application/use-cases/accept-invitation.use-case.js';
import { GetCurrentUser } from '../modules/auth/application/use-cases/get-current-user.use-case.js';
import { RevokeUserSessions } from '../modules/auth/application/use-cases/revoke-user-sessions.use-case.js';
import { SendInvitation } from '../modules/auth/application/use-cases/send-invitation.use-case.js';
import { UsersController } from '../modules/users/adapters/in/http/users.controller.js';
import {
  USERS_USE_CASES,
  type UsersUseCases,
} from '../modules/users/adapters/in/http/users.use-cases.js';
import type { UserRepository } from '../modules/users/application/ports/out/user-repository.port.js';
import { DeactivateUser } from '../modules/users/application/use-cases/deactivate-user.use-case.js';
import { DeleteUser } from '../modules/users/application/use-cases/delete-user.use-case.js';
import { InviteUser } from '../modules/users/application/use-cases/invite-user.use-case.js';
import { ListUsers } from '../modules/users/application/use-cases/list-users.use-case.js';
import { RequestUserPasswordReset } from '../modules/users/application/use-cases/request-user-password-reset.use-case.js';
import { ResendInvitation } from '../modules/users/application/use-cases/resend-invitation.use-case.js';
import { UpdateUser } from '../modules/users/application/use-cases/update-user.use-case.js';
import type { UsersDeps } from '../modules/users/application/users-deps.js';
import type {
  UserDeactivated,
  UserInvited,
  UserPasswordResetRequested,
} from '../modules/users/domain/events/user.events.js';
import type { InProcessEventPublisher } from '../shared/adapters/out/in-process-event-publisher.js';
import { AuthController } from '../modules/auth/adapters/in/http/auth.controller.js';
import {
  AUTH_USE_CASES,
  type AuthUseCases,
} from '../modules/auth/adapters/in/http/auth.use-cases.js';
import type { AuthDeps } from '../modules/auth/application/auth-deps.js';
import { AuthenticateAccessToken } from '../modules/auth/application/use-cases/authenticate-access-token.use-case.js';
import { ChangePassword } from '../modules/auth/application/use-cases/change-password.use-case.js';
import { CompletePasswordReset } from '../modules/auth/application/use-cases/complete-password-reset.use-case.js';
import { CreateApiKey } from '../modules/auth/application/use-cases/create-api-key.use-case.js';
import { ListApiKeys } from '../modules/auth/application/use-cases/list-api-keys.use-case.js';
import { Login } from '../modules/auth/application/use-cases/login.use-case.js';
import { Logout } from '../modules/auth/application/use-cases/logout.use-case.js';
import { RefreshTokenSession } from '../modules/auth/application/use-cases/refresh-token.use-case.js';
import { RequestPasswordReset } from '../modules/auth/application/use-cases/request-password-reset.use-case.js';
import { RevokeApiKey } from '../modules/auth/application/use-cases/revoke-api-key.use-case.js';
import { HealthController } from '../shared/adapters/http/health.controller.js';
import {
  ACCESS_TOKEN_AUTHENTICATOR,
  HTTP_CONFIG,
  type HttpConfig,
  RATE_LIMITER,
  READINESS_PROBE,
} from '../shared/adapters/http/tokens.js';
import type { RateLimiter, ReadinessProbe } from '../shared/ports/system.port.js';

export interface Infrastructure extends AuthDeps {
  readonly users: UserRepository;
  readonly contents: ContentRepository;
  readonly contentCategories: readonly string[];
  readonly media: MediaRepository;
  readonly storage: ObjectStorage;
  readonly svg: SvgSanitizer;
  readonly images: ImageProcessor;
  readonly variantQueue: MediaVariantQueue;
  readonly mediaConfig: MediaConfig;
  readonly auditReader: AuditEventReader;
  readonly events: InProcessEventPublisher;
  readonly rateLimiter: RateLimiter;
  readonly readiness: ReadinessProbe;
  readonly http: HttpConfig;
}

function createUsersUseCases(deps: UsersDeps): UsersUseCases {
  return {
    list: new ListUsers(deps),
    invite: new InviteUser(deps),
    update: new UpdateUser(deps),
    deactivate: new DeactivateUser(deps),
    remove: new DeleteUser(deps),
    requestPasswordReset: new RequestUserPasswordReset(deps),
    resendInvitation: new ResendInvitation(deps),
  };
}

function createContentUseCases(deps: ContentDeps): ContentUseCases {
  return {
    create: new CreateContent(deps),
    update: new UpdateContent(deps),
    get: new GetContent(deps),
    list: new ListContent(deps),
    stats: new ContentStats(deps),
    categories: new ContentCategories(deps),
    submit: new SubmitContent(deps),
    publish: new PublishContent(deps),
    reject: new RejectContent(deps),
    unpublish: new UnpublishContent(deps),
    archive: new ArchiveContent(deps),
    schedule: new ScheduleContent(deps),
    remove: new DeleteContent(deps),
    versions: new ListContentVersions(deps),
    version: new GetContentVersion(deps),
    revert: new RevertContent(deps),
  };
}

function createMediaUseCases(deps: MediaDeps): MediaUseCases {
  return {
    presign: new PresignUpload(deps),
    finalize: new FinalizeMedia(deps),
    update: new UpdateMedia(deps),
    remove: new DeleteMedia(deps),
    get: new GetMedia(deps),
    list: new ListMedia(deps),
  };
}

function createAuditUseCases(infrastructure: Infrastructure): AuditUseCases {
  const deps = { reader: infrastructure.auditReader, audit: infrastructure.audit };
  return { list: new ListAuditEvents(deps), export: new ExportAuditEvents(deps) };
}

// Modules talk through events and inbound ports only (04-ARCH 4.7), and this is where they meet.
function wireEvents(infrastructure: Infrastructure): void {
  const sendInvitation = new SendInvitation(infrastructure);
  const revokeSessions = new RevokeUserSessions(infrastructure);
  const requestReset = new RequestPasswordReset(infrastructure);
  const { events } = infrastructure;

  events.subscribe<UserInvited>('UserInvited', (event) => sendInvitation.execute(event));
  events.subscribe<UserDeactivated>('UserDeactivated', (event) =>
    revokeSessions.execute(event.userId),
  );
  events.subscribe<MediaUploaded>('MediaUploaded', async (event) => {
    if (event.needsVariants) await infrastructure.variantQueue.enqueue(event.mediaId);
  });
  events.subscribe<UserPasswordResetRequested>('UserPasswordResetRequested', (event) =>
    requestReset.execute(event),
  );
}

function createAuthUseCases(deps: AuthDeps): AuthUseCases {
  return {
    acceptInvitation: new AcceptInvitation(deps),
    currentUser: new GetCurrentUser(deps),
    login: new Login(deps),
    refresh: new RefreshTokenSession(deps),
    logout: new Logout(deps),
    requestPasswordReset: new RequestPasswordReset(deps),
    completePasswordReset: new CompletePasswordReset(deps),
    changePassword: new ChangePassword(deps),
    createApiKey: new CreateApiKey(deps),
    listApiKeys: new ListApiKeys(deps),
    revokeApiKey: new RevokeApiKey(deps),
  };
}

@Module({})
export class AppModule {}

// The composition root (04-ARCH 4.2): the only place that knows every adapter. Tests pass fakes
// through the same function, so they exercise the real wiring.
export function createAppModule(infrastructure: Infrastructure): DynamicModule {
  wireEvents(infrastructure);
  return {
    module: AppModule,
    global: true,
    controllers: [
      AuthController,
      ApiKeysController,
      UsersController,
      ContentController,
      MediaController,
      AuditController,
      HealthController,
    ],
    providers: [
      { provide: AUTH_USE_CASES, useValue: createAuthUseCases(infrastructure) },
      { provide: USERS_USE_CASES, useValue: createUsersUseCases(infrastructure) },
      { provide: CONTENT_USE_CASES, useValue: createContentUseCases(contentDeps(infrastructure)) },
      { provide: MEDIA_USE_CASES, useValue: createMediaUseCases(mediaDeps(infrastructure)) },
      { provide: AUDIT_USE_CASES, useValue: createAuditUseCases(infrastructure) },
      {
        provide: ACCESS_TOKEN_AUTHENTICATOR,
        useValue: new AuthenticateAccessToken(infrastructure),
      },
      { provide: RATE_LIMITER, useValue: infrastructure.rateLimiter },
      { provide: READINESS_PROBE, useValue: infrastructure.readiness },
      { provide: HTTP_CONFIG, useValue: infrastructure.http },
    ],
    exports: [ACCESS_TOKEN_AUTHENTICATOR],
  };
}
