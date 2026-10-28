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
 * On CI the build runs against the placeholder Firebase project from
 * `.github/workflows/ci.yml` (a project id ending in `-ci-fake`), so Google's
 * APIs answer the fake key with 400s; those "Failed to load resource" lines
 * are ignored (and logged) there only, and only for Google / Firebase hosts.
 *
 * Everything else still fails the test.
 */
import type { Page } from "@playwright/test";

const GEN_204 = /https:\/\/apis\.google\.com\/js\/gen_204(?=[?#'"\s.]|$)/;
const CSP = /Content Security Policy/i;
const COMPUTE_PRESSURE = /^Permissions policy violation: compute-pressure is not allowed in this document\.?$/;
const YOUTUBE_ORIGIN = /^https:\/\/www\.youtube(?:-nocookie)?\.com\//;
const LOAD_FAILED = /^Failed to load resource/;
const GOOGLE_API_ORIGIN = /^https:\/\/[\w.-]+\.(?:googleapis\.com|firebaseio\.com|firebaseapp\.com|google\.com)\//;
/** True when the app was built for the CI placeholder project, never for a real one. */
const PLACEHOLDER_FIREBASE = /-ci-fake$/.test(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "");

/**
 * The same gen_204 beacon as a raw `securitypolicyviolation` entry
 * ("connect-src https://apis.google.com/js/gen_204?c=…"), which the CSP spec
 * collects straight from the event instead of the console. Only that URL under
 * connect-src; any other directive or path still counts.
 */
export function cspNoiseReason(entry: string): string | null {
  return /^connect-src /.test(entry) && GEN_204.test(entry) ? "Google gen_204 beacon" : null;
}

/** Why a console error is known third-party noise, or null when it counts. */
export function noiseReason(text: string, sourceUrl: string): string | null {
  if (GEN_204.test(text) && CSP.test(text)) return "Google gen_204 beacon";
  if (COMPUTE_PRESSURE.test(text) && YOUTUBE_ORIGIN.test(sourceUrl)) return "YouTube compute-pressure";
  if (PLACEHOLDER_FIREBASE && LOAD_FAILED.test(text) && GOOGLE_API_ORIGIN.test(sourceUrl)) return "placeholder Firebase project on CI";
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
      console.log(`[e2e] ignored third-party noise (${reason}): ${text.slice(0, 160)} ← ${m.location().url.slice(0, 120)}`);
      return;
    }
    if (counts(text)) errors.push(text);
  });
  return errors;
}
