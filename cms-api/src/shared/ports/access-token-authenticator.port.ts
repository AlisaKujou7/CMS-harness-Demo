import type { Actor } from '../kernel/actor.js';

// Lets the shared HTTP guard authenticate requests without reaching into the auth module.
export interface AccessTokenAuthenticator {
  authenticate(token: string): Promise<Actor>;
}
