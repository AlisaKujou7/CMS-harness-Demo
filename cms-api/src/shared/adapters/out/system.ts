import { randomUUID } from 'node:crypto';
import type { Clock, IdGenerator } from '../../ports/system.port.js';

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

export class Uuidv4Generator implements IdGenerator {
  next(): string {
    return randomUUID();
  }
}
