import type { ReadinessProbe } from '../../ports/system.port.js';

export class CompositeReadinessProbe implements ReadinessProbe {
  constructor(private readonly checks: readonly (() => Promise<unknown>)[]) {}

  async check(): Promise<boolean> {
    const results = await Promise.allSettled(this.checks.map((check) => check()));
    return results.every((result) => result.status === 'fulfilled');
  }
}
