import TextField from '@mui/material/TextField';
import { forwardRef } from 'react';
import { format } from '../../../shared/i18n/format';

export interface CountedFieldProps {
  readonly label: string;
  readonly value: string;
  readonly limit: number;
  readonly error?: string | undefined;
  readonly placeholder?: string | undefined;
  readonly disabled: boolean;
  readonly multiline?: boolean;
  readonly name: string;
  onChange(event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void;
  onBlur(event: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>): void;
}

// 03-DESIGN 13.3: a live count that turns to the error color when over.
export const CountedField = forwardRef<HTMLInputElement, CountedFieldProps>(
  function CountedField(props, ref) {
    const { label, value, limit, error, placeholder, ...rest } = props;
    const over = value.length > limit;
    return (
      <TextField
        {...rest}
        inputRef={ref}
        label={label}
        value={value}
        size="small"
        error={over || error !== undefined}
        helperText={error ?? format('{count}/{limit}', { count: value.length, limit })}
        {...(placeholder === undefined
          ? {}
          : { placeholder, slotProps: { inputLabel: { shrink: true } } })}
      />
    );
  },
);
