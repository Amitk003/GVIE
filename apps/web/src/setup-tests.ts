import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Each test starts with an empty page, otherwise one render leaks into the next.
afterEach(() => {
  cleanup();
});
