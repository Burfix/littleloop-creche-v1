"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { CircleCheck, FileText } from "lucide-react";
import type { User } from "firebase/auth";
import type { LaunchUpload, LaunchUploadKind } from "@/lib/types";
import { reviewLaunchUpload, type AdminActor } from "@/lib/school-launch-admin";
import { StatusBadge } from "../../../owner/components/launch/StatusBadge";

interface UploadReviewListProps {
  schoolId: string;
  reviewerUid: string;
  uploads: Partial<Record<LaunchUploadKind, LaunchUpload>>;
  actor: AdminActor;
  firebaseUser: User | null;
  onSaved: () => void;
}

const KIND_LABELS: Record<LaunchUploadKind, string> = {
  children: "Enrolment list",
  teachers: "Teacher list",
  parents: "Parent list",
  feeStructure: "Fee structure",
};

const ALL_KINDS: LaunchUploadKind[] = ["children", "teachers", "parents", "feeStructure"];

function UploadRow({ schoolId, reviewerUid, kind, upload, actor, firebaseUser, onSaved }: {
  schoolId: string; reviewerUid: string; kind: LaunchUploadKind; upload?: LaunchUpload; actor: AdminActor; firebaseUser: User | null; onSaved: () => void;
}) {
  const [feedback, setFeedback] = useState("");
  const [showFeedback, setShowFeedback] = useState(false);
  const [saving, setSaving] = useState(false);

  const needsReview = upload && (upload.status === "submitted" || upload.status === "under_review");

  const handleAccept = async () => {
    if (!upload) return;
    setSaving(true);
    try {
      const idToken = await firebaseUser?.getIdToken();
      await reviewLaunchUpload(upload.id, schoolId, "accepted", reviewerUid, actor, undefined, idToken);
      toast.success(`${KIND_LABELS[kind]} accepted`);
      onSaved();
    } catch {
      toast.error("Couldn't save — please try again");
    } finally {
      setSaving(false);
    }
  };

  const handleNeedsChanges = async () => {
    if (!upload) return;
    setSaving(true);
    try {
      const idToken = await firebaseUser?.getIdToken();
      await reviewLaunchUpload(upload.id, schoolId, "needs_changes", reviewerUid, actor, feedback.trim() || undefined, idToken);
      toast.success(`Sent back for changes`);
      setShowFeedback(false);
      setFeedback("");
      onSaved();
    } catch {
      toast.error("Couldn't save — please try again");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>{KIND_LABELS[kind]}</p>
          {upload ? (
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 5 }}>
              <FileText size={12} aria-hidden="true" /> {upload.fileName} · {new Date(upload.submittedAt).toLocaleDateString("en-ZA")}
            </p>
          ) : (
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text-muted)" }}>No submission yet</p>
          )}
        </div>
        {upload && (
          upload.status === "accepted"
            ? <CircleCheck size={16} color="var(--success)" aria-hidden="true" />
            : <StatusBadge status={upload.status} />
        )}
      </div>

      {needsReview && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
          {showFeedback && (
            <textarea
              className="input"
              placeholder="What needs to change? (shown to the school)"
              value={feedback}
              onChange={e => setFeedback(e.target.value)}
              style={{ fontSize: 13 }}
            />
          )}
          <div style={{ display: "flex", gap: 6 }}>
            <button className="btn btn-primary" style={{ fontSize: 12, padding: "6px 10px", flex: 1 }} onClick={handleAccept} disabled={saving}>
              {saving ? <span className="spinner" /> : "Accept & import"}
            </button>
            {showFeedback ? (
              <button className="btn btn-danger" style={{ fontSize: 12, padding: "6px 10px", flex: 1 }} onClick={handleNeedsChanges} disabled={saving}>
                Send back
              </button>
            ) : (
              <button className="btn btn-secondary" style={{ fontSize: 12, padding: "6px 10px", flex: 1 }} onClick={() => setShowFeedback(true)} disabled={saving}>
                Needs changes
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function UploadReviewList({ schoolId, reviewerUid, uploads, actor, firebaseUser, onSaved }: UploadReviewListProps) {
  return (
    <div className="card" style={{ display: "flex", flexDirection: "column" }}>
      <h4 style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 700 }}>Data submissions</h4>
      {ALL_KINDS.map(kind => (
        <UploadRow key={kind} schoolId={schoolId} reviewerUid={reviewerUid} kind={kind} upload={uploads[kind]} actor={actor} firebaseUser={firebaseUser} onSaved={onSaved} />
      ))}
    </div>
  );
}
