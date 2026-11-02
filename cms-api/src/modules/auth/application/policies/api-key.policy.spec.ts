import { describe, expect, it } from 'vitest';
import { ForbiddenError } from '../../../../shared/kernel/app-error.js';
import { assertCanManageApiKeys } from './api-key.policy.js';

describe('assertCanManageApiKeys', () => {
  it('allows an admin', () => {
    expect(() => {
      assertCanManageApiKeys({ id: 'u', role: 'admin' });
    }).not.toThrow();
  });

  it.each(['editor', 'author'] as const)('forbids %s', (role) => {
    expect(() => {
      assertCanManageApiKeys({ id: 'u', role });
    }).toThrow(ForbiddenError);
  });
});
