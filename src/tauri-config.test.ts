import { describe, expect, it } from 'vitest';
import conf from '../src-tauri/tauri.conf.json';

// Regression guard: Tauri's native OS drag-drop handler is enabled by default and
// intercepts the webview's in-page HTML5 `drop` events — which silently breaks the
// board's drag-to-reorder. It MUST stay disabled for HTML5 DnD to work in the app.
describe('tauri.conf.json', () => {
  it('keeps dragDropEnabled false so in-page HTML5 drag & drop works', () => {
    const win = (conf as { app: { windows: Array<{ dragDropEnabled?: boolean }> } }).app.windows[0];
    expect(win.dragDropEnabled).toBe(false);
  });
});
