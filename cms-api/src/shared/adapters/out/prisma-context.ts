import { AsyncLocalStorage } from 'node:async_hooks';
import { PrismaPg } from '@prisma/adapter-pg';
import { type Prisma, PrismaClient } from '../../../generated/prisma/client.js';
import type { TransactionRunner } from '../../ports/system.port.js';

// LIKE treats these as wildcards, so a search for "100%" would otherwise match "100 things".
export function escapeLike(input: string): string {
  return input.replace(/[\\%_]/g, '\\$&');
}

// Repositories read `client` on every call, so they join whatever transaction is active without
// use cases passing a handle around.
export class PrismaContext implements TransactionRunner {
  private readonly root: PrismaClient;
  private readonly active = new AsyncLocalStorage<Prisma.TransactionClient>();

  constructor(connectionString: string) {
    this.root = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  }

  get client(): Prisma.TransactionClient {
    return this.active.getStore() ?? this.root;
  }

  run<T>(work: () => Promise<T>): Promise<T> {
    return this.root.$transaction((tx) => this.active.run(tx, work));
  }

  async ping(): Promise<void> {
    await this.root.$queryRaw`SELECT 1`;
  }

  disconnect(): Promise<void> {
    return this.root.$disconnect();
  }
}
