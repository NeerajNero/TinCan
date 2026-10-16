"use client";

import { useReportWebVitals } from "next/web-vitals";

/** Logs Core Web Vitals to the console in development only; a no-op in production. */
export function WebVitals() {
  useReportWebVitals((metric) => {
    if (process.env.NODE_ENV !== "development") return;
    console.info(`[web-vitals] ${metric.name}: ${Math.round(metric.value * 100) / 100} (${metric.rating})`);
  });
  return null;
}
