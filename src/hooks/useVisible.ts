"use client";

import { useSyncExternalStore } from "react";

const subscribe = (cb: () => void) => {
  document.addEventListener("visibilitychange", cb);
  window.addEventListener("focus", cb);
  window.addEventListener("blur", cb);
  return () => {
    document.removeEventListener("visibilitychange", cb);
    window.removeEventListener("focus", cb);
    window.removeEventListener("blur", cb);
  };
};
const get = () => document.visibilityState === "visible";
const getServer = () => false;

/** True while the tab is visible. */
export function useVisible(): boolean {
  return useSyncExternalStore(subscribe, get, getServer);
}
