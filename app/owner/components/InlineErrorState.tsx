"use client";

import { RefreshCw, MessageCircle } from "lucide-react";

interface InlineErrorStateProps {
  /** Calm, specific copy naming what failed to load, e.g. "We couldn't load
   * your School Launch." Never raw error text (see CLAUDE.md: never expose
   * technical errors to operators). */
  message: string;
  /** Optional supporting detail, e.g. "Last successful sync: 20 minutes ago." */
  detail?: string;
  onRetry?: () => void;
  retryLabel?: string;
  /** mailto: or other contact link. Omit rather than hardcode a fallback
   * address — a wrong or personal contact channel is worse than none. */
  contactHref?: string;
  contactLabel?: string;
}

// Reusable recoverable-error primitive: a specific, calm message plus a way
// forward (retry, and optionally a contact channel), never a bare toast or
// a silently blank screen. Used wherever School Launch data fails to load
// (see app/owner/page.tsx, app/owner/launch-summary/page.tsx).
export function InlineErrorState({
  message,
  detail,
  onRetry,
  retryLabel = "Try again",
  contactHref,
  contactLabel = "Contact support",
}: InlineErrorStateProps) {
  return (
    <div
      className="card"
      style={{ display: "flex", flexDirection: "column", gap: 10, textAlign: "center", alignItems: "center", padding: "28px 20px" }}
      role="alert"
    >
      <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{message}</p>
      {detail && (
        <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>{detail}</p>
      )}
      <div style={{ display: "flex", gap: 8, width: "100%", marginTop: 4 }}>
        {onRetry && (
          <button className="btn btn-primary" style={{ flex: 1, fontSize: 13 }} onClick={onRetry}>
            <RefreshCw size={14} aria-hidden="true" /> {retryLabel}
          </button>
        )}
        {contactHref && (
          <a
            href={contactHref}
            className="btn btn-secondary"
            style={{ flex: 1, fontSize: 13, textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
          >
            <MessageCircle size={14} aria-hidden="true" /> {contactLabel}
          </a>
        )}
      </div>
    </div>
  );
}
