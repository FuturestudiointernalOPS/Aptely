"use client";

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error("[ErrorBoundary]", error);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3">
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Something went wrong. Please reload the page.
          </p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="px-4 py-2 rounded-lg text-sm font-medium"
            style={{ backgroundColor: "var(--accent)", color: "white" }}
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
