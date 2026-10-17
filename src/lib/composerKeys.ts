/**
 * Composer behaviour shared by the main chat and the Watch / Listen room chats:
 * desktop Enter sends (Shift+Enter is a newline); on touch, Enter always adds a
 * newline and the Send button sends. The textarea grows up to `maxRows` lines.
 */
function isTouchDevice(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(hover: none) and (pointer: coarse)").matches;
}

export function enterSends(e: { key: string; shiftKey: boolean; nativeEvent?: { isComposing?: boolean } }): boolean {
  return e.key === "Enter" && !e.shiftKey && !e.nativeEvent?.isComposing && !isTouchDevice();
}

export function autoGrow(el: HTMLTextAreaElement | null, maxRows: number): void {
  if (!el) return;
  el.style.height = "0px";
  const line = parseFloat(getComputedStyle(el).lineHeight) || 22;
  el.style.height = `${Math.min(el.scrollHeight, line * maxRows + 20)}px`;
}
