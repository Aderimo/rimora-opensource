import { setupServer } from 'msw/node';
import { handlers } from './handlers';

/**
 * MSW Server
 * Server-side API mocking for Node.js tests
 */
export const server = setupServer(...handlers);
