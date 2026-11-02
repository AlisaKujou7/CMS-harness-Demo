export type ErrorKind =
  'validation' | 'unauthorized' | 'forbidden' | 'not_found' | 'conflict' | 'rate_limited';

export type ErrorDetails = Readonly<Record<string, unknown>>;

export interface AppErrorProps {
  readonly kind: ErrorKind;
  readonly code: string;
  readonly message: string;
  readonly details?: ErrorDetails;
}

// Domain and application errors extend this, so driving adapters can map them to a protocol
// without importing the domain (04-ARCH 4.8).
export class AppError extends Error {
  readonly kind: ErrorKind;
  readonly code: string;
  readonly details: ErrorDetails | undefined;

  constructor(props: AppErrorProps) {
    super(props.message);
    this.name = new.target.name;
    this.kind = props.kind;
    this.code = props.code;
    this.details = props.details;
  }
}

export class ForbiddenError extends AppError {
  constructor() {
    super({
      kind: 'forbidden',
      code: 'FORBIDDEN',
      message: 'You do not have permission to perform this action',
    });
  }
}
