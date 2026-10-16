"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  /** What to show instead of the broken widget. */
  fallback: ReactNode;
  children: ReactNode;
}

/**
 * A widget-sized boundary. The tab's error.tsx catches render errors too, but
 * it replaces the whole tab; wrap a self-contained widget fed by stored data
 * (a results list, a history) so one bad row only costs that widget.
 */
export class ErrorBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[widget error]", error, info.componentStack);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
