"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import type { LaunchNotification } from "@/lib/types";
import { markAllNotificationsRead, markNotificationRead, subscribeToLaunchNotifications } from "@/lib/launch-notifications";

interface NotificationBellProps {
  schoolId: string;
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(iso).toLocaleDateString("en-ZA", { day: "numeric", month: "short" });
}

// Realtime (onSnapshot, not a poll-on-mount fetch) so a specialist
// assignment, session, upload review, or go-live moment shows up without
// the owner needing to refresh — that's the whole problem this solves.
// The durable Firestore record backing this is the source of truth; a
// push notification (if the owner has granted permission) is a
// best-effort bonus on top, not a replacement for this list.
export function NotificationBell({ schoolId }: NotificationBellProps) {
  const [notifications, setNotifications] = useState<LaunchNotification[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!schoolId) return;
    const unsub = subscribeToLaunchNotifications(schoolId, setNotifications);
    return unsub;
  }, [schoolId]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const unreadCount = notifications.filter(n => !n.readAt).length;

  const handleOpen = () => setOpen(v => !v);

  const handleSelect = (notification: LaunchNotification) => {
    if (!notification.readAt) void markNotificationRead(notification.id);
    setOpen(false);
    if (notification.link) router.push(notification.link);
  };

  const handleMarkAllRead = () => {
    void markAllNotificationsRead(notifications);
  };

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <button
        onClick={handleOpen}
        aria-label={unreadCount > 0 ? `${unreadCount} unread notifications` : "Notifications"}
        style={{ position: "relative", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex" }}
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span
            aria-hidden="true"
            style={{
              position: "absolute", top: -2, right: -2, minWidth: 14, height: 14, borderRadius: 999,
              background: "var(--danger)", color: "white", fontSize: 9, fontWeight: 700,
              display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px",
            }}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="card"
          style={{
            position: "absolute", top: "calc(100% + 8px)", right: 0, width: 300, maxHeight: 360,
            overflowY: "auto", zIndex: 20, padding: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderBottom: "1px solid var(--border)" }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--brand)", fontSize: 12, fontWeight: 600 }}
              >
                Mark all read
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <p style={{ margin: 0, padding: "16px 12px", fontSize: 13, color: "var(--text-muted)", textAlign: "center" }}>
              Nothing yet — we&apos;ll let you know when something changes.
            </p>
          ) : (
            notifications.map(n => (
              <button
                key={n.id}
                onClick={() => handleSelect(n)}
                style={{
                  width: "100%", textAlign: "left", display: "flex", gap: 8, padding: "10px 12px",
                  border: "none", borderBottom: "1px solid var(--border)",
                  background: n.readAt ? "none" : "var(--brand-light)", cursor: "pointer",
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 6, height: 6, borderRadius: "50%", marginTop: 6, flexShrink: 0,
                    background: n.readAt ? "transparent" : "var(--brand)",
                  }}
                />
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: n.readAt ? 400 : 700 }}>{n.title}</p>
                  <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text-muted)" }}>{n.body}</p>
                  <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--text-muted)" }}>{timeAgo(n.createdAt)}</p>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
