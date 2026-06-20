// cardNav.ts — pure keyboard-navigation math for card selection on a board.
// Kept free of React/DOM so the grid/list traversal rules are unit-testable in
// isolation. Board.tsx feeds in the current column/row structure it already
// computes and applies the returned id as the new selection.

export type ArrowDirection = 'up' | 'down' | 'left' | 'right';

/**
 * Grouped (kanban) navigation. `columns` is the left-to-right list of visible
 * columns, each an ordered list of card ids (top-to-bottom). The selected card
 * sits at (column, row).
 *
 * - up/down: move within the current column, clamped (no wrap).
 * - left/right: scan to the nearest non-empty column in that direction and land
 *   on row min(currentRow, lastRow) — so a shorter column lands on its last
 *   card and fully empty columns are skipped.
 *
 * Returns the next card id, or null when there is nowhere to go (caller keeps
 * the current selection).
 */
export function nextSelectedInGrid(
  columns: string[][],
  currentId: string,
  dir: ArrowDirection,
): string | null {
  let ci = -1;
  let ri = -1;
  for (let c = 0; c < columns.length; c++) {
    const r = columns[c].indexOf(currentId);
    if (r !== -1) {
      ci = c;
      ri = r;
      break;
    }
  }
  if (ci === -1) return null; // selection not on this board structure

  if (dir === 'up') return ri > 0 ? columns[ci][ri - 1] : null;
  if (dir === 'down') return ri < columns[ci].length - 1 ? columns[ci][ri + 1] : null;

  const step = dir === 'right' ? 1 : -1;
  for (let c = ci + step; c >= 0 && c < columns.length; c += step) {
    const col = columns[c];
    if (col.length > 0) return col[Math.min(ri, col.length - 1)];
  }
  return null;
}

/**
 * Ungrouped ("Group by: None") list navigation. Up = previous, Down = next
 * (clamped, no wrap); Left/Right are no-ops in a single masonry list.
 */
export function nextSelectedInList(
  ids: string[],
  currentId: string,
  dir: ArrowDirection,
): string | null {
  const i = ids.indexOf(currentId);
  if (i === -1) return null;
  if (dir === 'up') return i > 0 ? ids[i - 1] : null;
  if (dir === 'down') return i < ids.length - 1 ? ids[i + 1] : null;
  return null;
}
