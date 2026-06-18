// @vitest-environment jsdom
// Covers the "Cmd/Ctrl+Enter finishes note editing (and saves)" behaviour added
// to the front-face notes editor. Renders the full App (dev-seed path, since the
// Tauri backend is absent under jsdom) and drives one seeded card's notes editor.

import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import App from '../App';

const SEED_NOTE =
  'Talk to 5 users about the first run, then sketch 3 entry points and prototype the warmest one.';

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

/** Open the notes editor for the first seeded card and return its textarea. */
async function openNotesEditor(): Promise<HTMLTextAreaElement> {
  const notes = await screen.findByText(SEED_NOTE);
  fireEvent.doubleClick(notes);
  const textarea = (await screen.findByDisplayValue(SEED_NOTE)) as HTMLTextAreaElement;
  return textarea;
}

describe('IndexCard notes editing — Cmd+Enter to finish', () => {
  it('saves and exits the editor on Cmd+Enter', async () => {
    render(<App />);
    const textarea = await openNotesEditor();

    const edited = 'Rewritten notes after research.';
    fireEvent.change(textarea, { target: { value: edited } });
    fireEvent.keyDown(textarea, { key: 'Enter', metaKey: true });

    // Editor closed and the new note text is displayed.
    expect(screen.queryByDisplayValue(edited)).toBeNull();
    expect(await screen.findByText(edited)).toBeTruthy();
  });

  it('saves and exits the editor on Ctrl+Enter (non-mac modifier)', async () => {
    render(<App />);
    const textarea = await openNotesEditor();

    const edited = 'Saved with control enter.';
    fireEvent.change(textarea, { target: { value: edited } });
    fireEvent.keyDown(textarea, { key: 'Enter', ctrlKey: true });

    expect(screen.queryByDisplayValue(edited)).toBeNull();
    expect(await screen.findByText(edited)).toBeTruthy();
  });

  it('keeps editing on plain Enter so notes stay multi-line', async () => {
    render(<App />);
    const textarea = await openNotesEditor();

    fireEvent.keyDown(textarea, { key: 'Enter' });

    // Still editing: the textarea remains mounted.
    expect(screen.getByDisplayValue(SEED_NOTE)).toBe(textarea);
  });
});
