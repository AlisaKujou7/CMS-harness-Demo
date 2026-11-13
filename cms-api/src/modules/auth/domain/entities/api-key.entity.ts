import { InvalidApiKeyNameError } from '../errors/auth.errors.js';

const MAX_NAME_LENGTH = 100;

export interface ApiKeyProps {
  readonly id: string;
  readonly name: string;
  readonly prefix: string;
  readonly keyHash: string;
  readonly createdBy: string;
  readonly createdAt: Date;
  readonly lastUsedAt: Date | null;
  readonly revokedAt: Date | null;
}

export class ApiKey implements ApiKeyProps {
  readonly id: string;
  readonly name: string;
  readonly prefix: string;
  readonly keyHash: string;
  readonly createdBy: string;
  readonly createdAt: Date;
  readonly lastUsedAt: Date | null;
  readonly revokedAt: Date | null;

  private constructor(props: ApiKeyProps) {
    this.id = props.id;
    this.name = props.name;
    this.prefix = props.prefix;
    this.keyHash = props.keyHash;
    this.createdBy = props.createdBy;
    this.createdAt = props.createdAt;
    this.lastUsedAt = props.lastUsedAt;
    this.revokedAt = props.revokedAt;
  }

  static create(input: {
    id: string;
    name: string;
    prefix: string;
    keyHash: string;
    createdBy: string;
    now: Date;
  }): ApiKey {
    const name = input.name.trim();
    if (name === '' || name.length > MAX_NAME_LENGTH) throw new InvalidApiKeyNameError();
    return new ApiKey({
      id: input.id,
      name,
      prefix: input.prefix,
      keyHash: input.keyHash,
      createdBy: input.createdBy,
      createdAt: input.now,
      lastUsedAt: null,
      revokedAt: null,
    });
  }

  static restore(props: ApiKeyProps): ApiKey {
    return new ApiKey(props);
  }

  isActive(): boolean {
    return this.revokedAt === null;
  }

  revoke(now: Date): ApiKey {
    return new ApiKey({ ...this, revokedAt: this.revokedAt ?? now });
  }

  markUsed(now: Date): ApiKey {
    return new ApiKey({ ...this, lastUsedAt: now });
  }
}
