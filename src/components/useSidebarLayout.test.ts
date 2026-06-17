// @vitest-environment jsdom
// Unit tests for the sidebar layout hook: defaults, localStorage rehydration,
// width clamping, collapse persistence, and the pointer-drag resize gesture
// (clamping during move, the `resizing` flag, persistence on pointer-up,
// listener teardown, and full teardown if the hook unmounts mid-drag).

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import {
  SIDEBAR_DEFAULT_WIDTH,
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH,
  useSidebarLayout,
} from './useSidebarLayout';

const KEY = 'taskdex_sidebar';

beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

// jsdom lacks PointerEvent; synthesize one carrying button + clientX.
function pointerEvent(type: string, init: { button?: number; clientX?: number }): PointerEvent {
  const ev = new Event(type, { bubbles: true }) as PointerEvent;
  Object.assign(ev, { button: init.button ?? 0, clientX: init.clientX ?? 0 });
  return ev;
}

// Mimic the onPointerDown React passes to startResize (only button + clientX read).
function down(button: number, clientX: number) {
  return { button, clientX, preventDefault() {} } as unknown as React.PointerEvent;
}

describe('useSidebarLayout', () => {
  it('defaults to the design width, expanded, when nothing is stored', () => {
    const { result } = renderHook(() => useSidebarLayout());
    expect(result.current.width).toBe(SIDEBAR_DEFAULT_WIDTH);
    expect(result.current.collapsed).toBe(false);
    expect(result.current.resizing).toBe(false);
  });

  it('rehydrates a previously stored width and collapsed state', () => {
    localStorage.setItem(KEY, JSON.stringify({ width: 320, collapsed: true }));
    const { result } = renderHook(() => useSidebarLayout());
    expect(result.current.width).toBe(320);
    expect(result.current.collapsed).toBe(true);
  });

  it('clamps an out-of-range stored width into the allowed band', () => {
    localStorage.setItem(KEY, JSON.stringify({ width: 9999, collapsed: false }));
    expect(renderHook(() => useSidebarLayout()).result.current.width).toBe(SIDEBAR_MAX_WIDTH);

    localStorage.setItem(KEY, JSON.stringify({ width: 10, collapsed: false }));
    expect(renderHook(() => useSidebarLayout()).result.current.width).toBe(SIDEBAR_MIN_WIDTH);
  });

  it('falls back to defaults on malformed stored JSON', () => {
    localStorage.setItem(KEY, '{not valid json');
    const { result } = renderHook(() => useSidebarLayout());
    expect(result.current.width).toBe(SIDEBAR_DEFAULT_WIDTH);
    expect(result.current.collapsed).toBe(false);
  });

  it('toggleCollapsed flips state and persists it', () => {
    const { result } = renderHook(() => useSidebarLayout());
    act(() => result.current.toggleCollapsed());
    expect(result.current.collapsed).toBe(true);
    expect(JSON.parse(localStorage.getItem(KEY)!)).toMatchObject({ collapsed: true });

    act(() => result.current.toggleCollapsed());
    expect(result.current.collapsed).toBe(false);
    expect(JSON.parse(localStorage.getItem(KEY)!)).toMatchObject({ collapsed: false });
  });

  it('resizes on pointer drag, clamps to the band, and persists on release', () => {
    const { result } = renderHook(() => useSidebarLayout());

    act(() => result.current.startResize(down(0, 100)));
    expect(result.current.resizing).toBe(true);

    // Drag right by 60px → width grows from the 248 default to 308.
    act(() => window.dispatchEvent(pointerEvent('pointermove', { clientX: 160 })));
    expect(result.current.width).toBe(SIDEBAR_DEFAULT_WIDTH + 60);

    // Drag far left past the minimum → clamped, not negative.
    act(() => window.dispatchEvent(pointerEvent('pointermove', { clientX: -5000 })));
    expect(result.current.width).toBe(SIDEBAR_MIN_WIDTH);

    // Drag far right past the maximum → clamped to the ceiling.
    act(() => window.dispatchEvent(pointerEvent('pointermove', { clientX: 5000 })));
    expect(result.current.width).toBe(SIDEBAR_MAX_WIDTH);

    act(() => window.dispatchEvent(pointerEvent('pointerup', {})));
    expect(result.current.resizing).toBe(false);
    expect(JSON.parse(localStorage.getItem(KEY)!)).toMatchObject({
      width: SIDEBAR_MAX_WIDTH,
      collapsed: false,
    });
  });

  it('ignores non-primary buttons (no drag started on right-click)', () => {
    const { result } = renderHook(() => useSidebarLayout());
    act(() => result.current.startResize(down(2, 100)));
    expect(result.current.resizing).toBe(false);

    // A stray pointermove must not move the panel since no drag is active.
    act(() => window.dispatchEvent(pointerEvent('pointermove', { clientX: 300 })));
    expect(result.current.width).toBe(SIDEBAR_DEFAULT_WIDTH);
  });

  it('tears the gesture down on unmount mid-drag (no leaked listeners)', () => {
    const { result, unmount } = renderHook(() => useSidebarLayout());

    act(() => result.current.startResize(down(0, 100)));
    expect(document.body.style.cursor).toBe('col-resize');

    unmount();

    // Body styles restored, and a post-unmount pointermove is a no-op (listener
    // removed) — if it still fired it would throw trying to setState on unmount.
    expect(document.body.style.cursor).toBe('');
    expect(() =>
      window.dispatchEvent(pointerEvent('pointermove', { clientX: 999 })),
    ).not.toThrow();
  });
});
