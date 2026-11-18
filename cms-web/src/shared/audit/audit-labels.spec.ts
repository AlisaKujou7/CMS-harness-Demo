import { describe, expect, it } from 'vitest';
import { aUser } from '../../../test/builders';
import { actionLabel, actorName } from './audit-labels';

describe('actionLabel', () => {
  it('describes a known action, and shows an unknown one as it is', () => {
    expect(actionLabel('content.publish')).toBe('published content');
    expect(actionLabel('new.action')).toBe('new.action');
  });
});

describe('actorName', () => {
  const users = [aUser({ id: 'u1', name: 'Alice' })];

  it('names the user, the system, or someone since deleted', () => {
    expect(actorName('u1', users)).toBe('Alice');
    expect(actorName(null, users)).toBe('System');
    expect(actorName('gone', users)).toBe('Someone');
  });
});
