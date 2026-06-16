// @vitest-environment jsdom
// Smoke test: the app boots and renders the seeded board (dev-seed path used when
// not running inside Tauri). The backend round-trip is covered by the Rust ops tests.

import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import App from './App';

beforeAll(() => {
  // jsdom has no matchMedia; ThemeProvider needs it.
  if (!window.matchMedia) {
    window.matchMedia = (query: string) =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList;
  }
});

afterEach(cleanup);

describe('App boot', () => {
  it('boots, seeds, and renders the first board with its cards', async () => {
    render(<App />);
    // "Product Sprint" appears in both the sidebar row and the top bar
    expect((await screen.findAllByText('Product Sprint')).length).toBeGreaterThanOrEqual(1);
    // a seeded card title
    expect(await screen.findByText('Redesign onboarding flow')).toBeTruthy();
    // sidebar shows all three boards
    expect(screen.getByText('By Priority')).toBeTruthy();
    expect(screen.getByText('Reading List')).toBeTruthy();
    // card count reflects the 12 seeded cards
    expect(screen.getByText('12 cards')).toBeTruthy();
  });
});
