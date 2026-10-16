/**
 * Focus without letting the browser scroll anything into view. The document
 * is locked (see globals.css and useDocumentScrollLock); a plain focus() or the
 * autoFocus attribute would still scroll the layout viewport on Android and
 * drag the tab bar up with it.
 */
export function focusNoScroll(el: HTMLElement | null | undefined): void {
  el?.focus({ preventScroll: true });
}

/** Stable callback ref: focuses once on mount, without scrolling. Use instead of `autoFocus`. */
export const autoFocusRef = (el: HTMLElement | null): void => focusNoScroll(el);
