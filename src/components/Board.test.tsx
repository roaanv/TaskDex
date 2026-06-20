// @vitest-environment jsdom
// Integration coverage for card selection + keyboard navigation wiring. Renders
// the full App (dev-seed path under jsdom). The default board is "Product Sprint"
// (group-by Status); its Backlog column holds two cards in created order:
//   1. "Write Q3 OKRs"          (notes: "Draft 3 objectives...")
//   2. "Interview 5 power users" (notes: "Recruit from the beta cohort...")
// The pure grid/list math is unit-tested in cardNav.test.ts; these tests prove
// click→select, Enter→edit-notes, arrow movement, and deselect are wired up.

import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from '../App';

const CARD1_NOTES = 'Draft 3 objectives with measurable key results and circulate for feedback.';
const CARD2_NOTES = "Recruit from the beta cohort. Focus on workflows we don't support yet.";

beforeAll(() => {
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
  // jsdom doesn't implement scrollIntoView; the keep-in-view effect calls it.
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
  }
});

afterEach(cleanup);

/** Single-click the card with the given title to select it. */
async function selectCardByTitle(title: string): Promise<void> {
  const span = await screen.findByText(title);
  fireEvent.click(span);
}

describe('Board — card selection & keyboard navigation', () => {
  it('selects a card on click and opens its notes editor on Enter', async () => {
    render(<App />);
    await selectCardByTitle('Write Q3 OKRs');

    fireEvent.keyDown(document.body, { key: 'Enter' });

    expect(await screen.findByDisplayValue(CARD1_NOTES)).toBeTruthy();
  });

  it('moves the selection down a column with ArrowDown', async () => {
    render(<App />);
    await selectCardByTitle('Write Q3 OKRs');

    fireEvent.keyDown(document.body, { key: 'ArrowDown' });
    fireEvent.keyDown(document.body, { key: 'Enter' });

    // Enter now edits the *second* Backlog card, proving the selection moved.
    expect(await screen.findByDisplayValue(CARD2_NOTES)).toBeTruthy();
  });

  it('clears the selection on Escape so shortcuts no longer act', async () => {
    render(<App />);
    await selectCardByTitle('Write Q3 OKRs');

    fireEvent.keyDown(document.body, { key: 'Escape' });
    fireEvent.keyDown(document.body, { key: 'Enter' });

    // No notes editor opened — the notes remain static text.
    await waitFor(() => {
      expect(screen.queryByDisplayValue(CARD1_NOTES)).toBeNull();
    });
  });
});
