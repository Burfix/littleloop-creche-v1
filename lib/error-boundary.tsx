"use client";

import React from "react";

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

/**
 * Catches unhandled render errors in the subtree and shows a safe fallback.
 * Wrap individual page sections rather than the whole app so one broken widget
 * doesn't take down the entire UI.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info.componentStack);
  }

  reset = () => this.setState({ hasError: false, message: "" });

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div
          style={{
            padding: "24px 20px",
            textAlign: "center",
            color: "var(--text-muted)",
          }}
        >
          <p style={{ fontSize: 32, margin: "0 0 8px" }}>⚠️</p>
          <p style={{ fontWeight: 600, fontSize: 15, margin: "0 0 6px", color: "var(--text)" }}>
            Something went wrong
          </p>
          <p style={{ fontSize: 13, margin: "0 0 16px" }}>
            {this.state.message || "An unexpected error occurred."}
          </p>
          <button
            className="btn btn-secondary"
            onClick={this.reset}
            style={{ fontSize: 13 }}
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Lightweight inline error display for async data-fetch failures.
 * Use in page components when a useEffect/fetch returns an error.
 */
export function DataError({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div
      style={{
        padding: "20px 16px",
        textAlign: "center",
        color: "var(--text-muted)",
      }}
    >
      <p style={{ fontSize: 13, margin: "0 0 12px" }}>{message}</p>
      {onRetry && (
        <button className="btn btn-secondary" onClick={onRetry} style={{ fontSize: 13 }}>
          Retry
        </button>
      )}
    </div>
  );
}
