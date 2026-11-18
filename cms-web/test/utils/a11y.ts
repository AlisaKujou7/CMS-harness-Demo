import axe from 'axe-core';
import { expect } from 'vitest';

// jsdom has no layout, so contrast is checked in the browser instead (M-BUN-08). A modal hides what
// is behind it and traps focus itself, which axe cannot see from the markup alone.
export async function expectNoA11yViolations(container: Element = document.body): Promise<void> {
  const results = await axe.run(container, {
    rules: {
      'color-contrast': { enabled: false },
      region: { enabled: false },
      'aria-hidden-focus': { enabled: false },
    },
  });
  expect(results.violations.map((violation) => violation.id)).toEqual([]);
}
