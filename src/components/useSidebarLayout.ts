// useSidebarLayout.ts — owns the left panel's width + collapsed state, its
// localStorage persistence, and the pointer-drag resize gesture. Kept separate
// from Shell/Sidebar so the layout components stay presentational. Mirrors the
// ThemeContext convention of a localStorage paint-cache for UI preferences
// (there is no backend command for sidebar geometry, so localStorage stands alone).

import { useCallback, useEffect, useRef, useState } from 'react';

export const SIDEBAR_MIN_WIDTH = 200;
export const SIDEBAR_MAX_WIDTH = 460;
export const SIDEBAR_DEFAULT_WIDTH = 248;

const SIDEBAR_KEY = 'taskdex_sidebar';

interface StoredLayout {
  width: number;
  collapsed: boolean;
}

const clampWidth = (w: number): number =>
  Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, Math.round(w)));

function readStored(): StoredLayout {
  try {
    const raw = localStorage.getItem(SIDEBAR_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<StoredLayout>;
      return {
        width: clampWidth(typeof parsed.width === 'number' ? parsed.width : SIDEBAR_DEFAULT_WIDTH),
        collapsed: parsed.collapsed === true,
      };
    }
  } catch {
    /* fall through to defaults */
  }
  return { width: SIDEBAR_DEFAULT_WIDTH, collapsed: false };
}

function persist(layout: StoredLayout): void {
  try {
    localStorage.setItem(SIDEBAR_KEY, JSON.stringify(layout));
  } catch {
    /* non-fatal: geometry simply won't survive a reload */
  }
}

export interface SidebarLayout {
  width: number;
  collapsed: boolean;
  /** true only while a resize drag is in progress (suppresses width transitions). */
  resizing: boolean;
  toggleCollapsed: () => void;
  /** attach to the resize handle's onPointerDown. */
  startResize: (e: React.PointerEvent) => void;
}

export function useSidebarLayout(): SidebarLayout {
  const initial = useRef<StoredLayout>(readStored());
  const [width, setWidth] = useState<number>(initial.current.width);
  const [collapsed, setCollapsed] = useState<boolean>(initial.current.collapsed);
  const [resizing, setResizing] = useState(false);

  // Live ref so the drag handler reads the current width without re-binding listeners.
  const widthRef = useRef(width);
  widthRef.current = width;

  // Teardown for an in-progress drag. Stored in a ref so BOTH pointer-up and the
  // unmount cleanup can fully end the gesture (remove listeners + restore body
  // styles); without this, an unmount mid-drag would leak the window listeners.
  const endDragRef = useRef<(() => void) | null>(null);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((c) => {
      const next = !c;
      persist({ width: widthRef.current, collapsed: next });
      return next;
    });
  }, []);

  const startResize = useCallback((e: React.PointerEvent) => {
    // Only respond to the primary (left) button; ignore right/middle clicks so
    // the context menu isn't suppressed and a stray drag isn't started.
    if (e.button !== 0) return;
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = widthRef.current;
    // Track the live width locally so pointer-up persists the final value even if
    // React hasn't re-rendered (which would leave widthRef one move stale).
    let latestWidth = startWidth;
    setResizing(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMove = (ev: PointerEvent) => {
      latestWidth = clampWidth(startWidth + (ev.clientX - startX));
      setWidth(latestWidth);
    };
    const endDrag = (opts?: { persistGeometry?: boolean }) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      endDragRef.current = null;
      setResizing(false);
      if (opts?.persistGeometry) persist({ width: latestWidth, collapsed: false });
    };
    const onUp = () => endDrag({ persistGeometry: true });

    endDragRef.current = () => endDrag();
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, []);

  // Safety net: if the component unmounts mid-drag, fully tear the gesture down
  // (remove listeners + restore body styles) rather than leaking the listeners.
  useEffect(
    () => () => {
      endDragRef.current?.();
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    },
    [],
  );

  return { width, collapsed, resizing, toggleCollapsed, startResize };
}
