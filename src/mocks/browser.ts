import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

/**
 * MSW Browser Worker
 * Client-side API mocking for development and testing
 */
export const worker = setupWorker(...handlers);
