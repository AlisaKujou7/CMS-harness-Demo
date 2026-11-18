import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import TextField, { type TextFieldProps } from '@mui/material/TextField';
import { forwardRef, useState } from 'react';
import { HideIcon, PreviewIcon } from '../../design-system/icons';
import { formMessages } from './forms.messages';

export const PasswordField = forwardRef<HTMLDivElement, TextFieldProps>(
  function PasswordField(props, ref) {
    const [visible, setVisible] = useState(false);
    return (
      <TextField
        {...props}
        ref={ref}
        type={visible ? 'text' : 'password'}
        slotProps={{
          input: {
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  edge="end"
                  aria-label={visible ? formMessages.hidePassword : formMessages.showPassword}
                  onClick={() => {
                    setVisible((value) => !value);
                  }}
                >
                  {visible ? <HideIcon /> : <PreviewIcon />}
                </IconButton>
              </InputAdornment>
            ),
          },
        }}
      />
    );
  },
);
