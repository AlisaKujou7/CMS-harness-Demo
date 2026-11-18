import { setupServer } from 'msw/node';

// Every spec declares the responses it depends on, so an unexpected call fails the test.
export const server = setupServer();
