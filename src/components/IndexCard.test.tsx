// @vitest-environment jsdom
// Covers the "Cmd/Ctrl+Enter finishes note editing (and saves)" behaviour added
// to the front-face notes editor. Renders the full App (dev-seed path, since the
// Tauri backend is absent under jsdom) and drives one seeded card's notes editor.

import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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

describe('IndexCard — new card opens in title edit mode', () => {
  it('focuses the title input (with the placeholder selected) when a card is added', async () => {
    render(<App />);

    // The top-bar "+ Card" button (distinct from the column "+ Add card" buttons).
    const addBtn = screen.getByRole('button', { name: /^\+\s*Card$/ });
    fireEvent.click(addBtn);

    // The new card's title input is mounted, focused, and its placeholder selected.
    const input = (await screen.findByDisplayValue('New task')) as HTMLInputElement;
    expect(input.tagName).toBe('INPUT');
    expect(document.activeElement).toBe(input);
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe('New task'.length);

    // Typing replaces the placeholder and saving shows the new title.
    fireEvent.change(input, { target: { value: 'Plan the offsite' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(await screen.findByText('Plan the offsite')).toBeTruthy();
  });
});

describe('IndexCard — Tab moves from title to notes editing', () => {
  it('commits the title and opens the focused notes editor on Tab', async () => {
    render(<App />);

    const addBtn = screen.getByRole('button', { name: /^\+\s*Card$/ });
    fireEvent.click(addBtn);

    const input = (await screen.findByDisplayValue('New task')) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Plan the offsite' } });
    fireEvent.keyDown(input, { key: 'Tab' });

    // Title was committed and is shown as static text (the input is gone).
    expect(await screen.findByText('Plan the offsite')).toBeTruthy();

    // The notes editor is now open and holds focus.
    await waitFor(() => {
      const active = document.activeElement as HTMLElement | null;
      expect(active?.tagName).toBe('TEXTAREA');
    });
  });

  it('selects the existing title when double-clicking to edit it', async () => {
    render(<App />);

    const titleSpan = await screen.findByText('Redesign onboarding flow');
    fireEvent.doubleClick(titleSpan);

    const titleInput = (await screen.findByDisplayValue(
      'Redesign onboarding flow',
    )) as HTMLInputElement;
    await waitFor(() => {
      expect(document.activeElement).toBe(titleInput);
      expect(titleInput.selectionStart).toBe(0);
      expect(titleInput.selectionEnd).toBe('Redesign onboarding flow'.length);
    });
  });

  it('selects all existing note text when tabbing into the notes editor', async () => {
    render(<App />);

    // Edit the seeded card whose notes are SEED_NOTE.
    const titleSpan = await screen.findByText('Redesign onboarding flow');
    fireEvent.doubleClick(titleSpan);
    const titleInput = (await screen.findByDisplayValue(
      'Redesign onboarding flow',
    )) as HTMLInputElement;

    fireEvent.keyDown(titleInput, { key: 'Tab' });

    // The notes editor opens with the full note text selected.
    const textarea = (await screen.findByDisplayValue(SEED_NOTE)) as HTMLTextAreaElement;
    await waitFor(() => {
      expect(document.activeElement).toBe(textarea);
      expect(textarea.selectionStart).toBe(0);
      expect(textarea.selectionEnd).toBe(SEED_NOTE.length);
    });
  });
});

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
