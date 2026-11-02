import type {
  AuditLog,
  Clock,
  EmailSender,
  IdGenerator,
  Logger,
  TransactionRunner,
} from '../../../shared/ports/system.port.js';
import type {
  AccountRepository,
  ApiKeyRepository,
  InvitationTokenRepository,
  LoginLockoutRepository,
  PasswordResetTokenRepository,
  RefreshTokenRepository,
} from './ports/out/repositories.port.js';
import type {
  AccessTokenSigner,
  OpaqueTokenService,
  PasswordHasher,
} from './ports/out/security.port.js';

export interface AuthConfig {
  readonly accessTokenTtlSeconds: number;
  readonly refreshTokenTtlMs: number;
  readonly publicUrl: string;
}

export interface AuthDeps {
  readonly accounts: AccountRepository;
  readonly lockouts: LoginLockoutRepository;
  readonly refreshTokens: RefreshTokenRepository;
  readonly resetTokens: PasswordResetTokenRepository;
  readonly invitationTokens: InvitationTokenRepository;
  readonly apiKeys: ApiKeyRepository;
  readonly hasher: PasswordHasher;
  readonly signer: AccessTokenSigner;
  readonly opaqueTokens: OpaqueTokenService;
  readonly clock: Clock;
  readonly ids: IdGenerator;
  readonly tx: TransactionRunner;
  readonly audit: AuditLog;
  readonly email: EmailSender;
  readonly logger: Logger;
  readonly config: AuthConfig;
}
