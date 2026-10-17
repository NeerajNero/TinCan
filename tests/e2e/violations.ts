/**
 * The shared collector for page errors and console errors (CSP and
 * Permissions-Policy violations among them). Specs assert the returned list is
 * empty. Exactly two third-party messages are ignored, and logged, because
 * neither comes from our code and the policies stay as strict as they are:
 *
 * - Google sign-in's gapi script pings `https://apis.google.com/js/gen_204`,
 *   which connect-src blocks (two console lines: the CSP refusal and the fetch).
 * - The YouTube embed sometimes probes the `compute-pressure` feature, which the
 *   Permissions-Policy doesn't delegate to it. Ignored only when the message
 *   comes from a YouTube origin.
 *
 * Everything else still fails the test.
 */
import type { Page } from "@playwright/test";

const GEN_204 = /https:\/\/apis\.google\.com\/js\/gen_204(?=[?#'"\s.]|$)/;
const CSP = /Content Security Policy/i;
const COMPUTE_PRESSURE = /^Permissions policy violation: compute-pressure is not allowed in this document\.?$/;
const YOUTUBE_ORIGIN = /^https:\/\/www\.youtube(?:-nocookie)?\.com\//;

/** Why a console error is known third-party noise, or null when it counts. */
export function noiseReason(text: string, sourceUrl: string): string | null {
  if (GEN_204.test(text) && CSP.test(text)) return "Google gen_204 beacon";
  if (COMPUTE_PRESSURE.test(text) && YOUTUBE_ORIGIN.test(sourceUrl)) return "YouTube compute-pressure";
  return null;
}

/**
 * Collects page errors and console errors from now on. `counts` narrows which
 * console errors matter (default: all of them); noise is dropped before it.
 */
export function collectErrors(page: Page, counts: (text: string) => boolean = () => true): string[] {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const text = m.text();
    const reason = noiseReason(text, m.location().url);
    if (reason) {
      console.log(`[e2e] ignored third-party noise (${reason}): ${text.slice(0, 160)}`);
      return;
    }
    if (counts(text)) errors.push(text);
  });
  return errors;
}
