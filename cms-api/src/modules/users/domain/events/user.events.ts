export interface UserInvited {
  readonly type: 'UserInvited';
  readonly userId: string;
  readonly email: string;
}

export interface UserDeactivated {
  readonly type: 'UserDeactivated';
  readonly userId: string;
}

export interface UserPasswordResetRequested {
  readonly type: 'UserPasswordResetRequested';
  readonly email: string;
  readonly ip: string | null;
}
