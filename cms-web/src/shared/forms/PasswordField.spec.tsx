import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithTheme } from '../../../test/utils/render-with-providers';
import { PasswordField } from './PasswordField';

describe('PasswordField', () => {
  it('hides the value until asked to show it', async () => {
    const { user } = renderWithTheme(<PasswordField label="Password" />);
    const input = screen.getByLabelText('Password');

    expect(input).toHaveAttribute('type', 'password');
    await user.click(screen.getByRole('button', { name: 'Show password' }));
    expect(input).toHaveAttribute('type', 'text');
    await user.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(input).toHaveAttribute('type', 'password');
  });
});
