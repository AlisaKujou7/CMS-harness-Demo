import { AppError } from './app-error.js';

const MAX_LENGTH = 254;
const MAX_LOCAL_LENGTH = 64;
const LOCAL_PART = /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/;
const DOMAIN = /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])$/;

export class InvalidEmailError extends AppError {
  constructor() {
    super({
      kind: 'validation',
      code: 'VALIDATION_ERROR',
      message: 'Enter a valid email address',
      details: { field: 'email' },
    });
  }
}

function isValid(address: string): boolean {
  const [local, domain, extra] = address.split('@');
  if (local === undefined || domain === undefined || extra !== undefined) return false;
  if (address.length > MAX_LENGTH || local.length > MAX_LOCAL_LENGTH) return false;
  return LOCAL_PART.test(local) && DOMAIN.test(domain);
}

// Accepts the dot-atom form of an RFC 5322 addr-spec. Quoted local parts and address literals are
// valid RFC syntax but are not deliverable through the email providers this system uses.
export class Email {
  private constructor(readonly value: string) {}

  static create(input: string): Email {
    const normalized = input.trim().toLowerCase();
    if (!isValid(normalized)) throw new InvalidEmailError();
    return new Email(normalized);
  }

  static parse(input: string): Email | null {
    const normalized = input.trim().toLowerCase();
    return isValid(normalized) ? new Email(normalized) : null;
  }

  equals(other: Email): boolean {
    return this.value === other.value;
  }
}
