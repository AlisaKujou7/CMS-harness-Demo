import { describe, expect, it } from 'vitest';
import { assertNever } from './assert-never.js';

describe('assertNever', () => {
  it('throws and names the value that the type system ruled out', () => {
    expect(() => assertNever('surprise' as never)).toThrow('Unexpected value: "surprise"');
  });
});
