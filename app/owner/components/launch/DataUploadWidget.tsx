"use client";

import { useRef, useState, type ChangeEvent } from "react";
import toast from "react-hot-toast";
import { FileText, UploadCloud, X } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { uploadLaunchFile, createLaunchUpload } from "@/lib/launch-uploads";
import type { LaunchUpload, LaunchUploadKind } from "@/lib/types";
import { StatusBadge } from "./StatusBadge";

interface DataUploadWidgetProps {
  schoolId: string;
  kind: LaunchUploadKind;
  /** Button label for the very first upload, e.g. "Upload enrolment list". */
  actionLabel: string;
  helpText: string;
  latestUpload?: LaunchUpload;
  onUploaded: () => void;
}

// State machine: empty -> file selected -> submitted -> (LittleLoop review:
// under_review | needs_changes) -> accepted. "Replace file" is available
// any time nothing's been accepted yet — it creates a new LaunchUpload doc
// rather than mutating the old one (see lib/launch-uploads.ts).
export function DataUploadWidget({ schoolId, kind, actionLabel, helpText, latestUpload, onUploaded }: DataUploadWidgetProps) {
  const { appUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleFileSelected = (e: ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) setFile(selected);
  };

  const handleSubmit = async () => {
    if (!file || !appUser) return;
    setSubmitting(true);
    try {
      const fileUrl = await uploadLaunchFile(schoolId, kind, file);
      await createLaunchUpload(schoolId, kind, file.name, fileUrl, appUser.uid);
      toast.success("Uploaded. We'll take it from here.");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      onUploaded();
    } catch {
      toast.error("Upload failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // Accepted — done. Compact confirmation, no further action.
  if (!file && latestUpload?.status === "accepted") {
    return (
      <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 6 }}>
        <FileText size={14} aria-hidden="true" /> {latestUpload.fileName}, imported
      </p>
    );
  }

  // A file is staged locally but not yet submitted.
  if (file) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <FileText size={14} color="var(--brand)" aria-hidden="true" />
          <span style={{ fontSize: 13, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {file.name}
          </span>
          <button
            type="button"
            onClick={() => setFile(null)}
            aria-label="Remove selected file"
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", minWidth: 32, minHeight: 32 }}
          >
            <X size={14} />
          </button>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          style={{ fontSize: 13, padding: "8px 12px", alignSelf: "flex-start" }}
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting ? <span className="spinner" /> : "Submit"}
        </button>
      </div>
    );
  }

  // Submitted / under review — waiting on LittleLoop, nothing to do.
  if (latestUpload && (latestUpload.status === "submitted" || latestUpload.status === "under_review")) {
    return (
      <StatusBadge
        status={latestUpload.status}
        detail={`${latestUpload.fileName}: ${latestUpload.status === "under_review" ? "LittleLoop is reviewing your data" : "submitted, awaiting review"}`}
      />
    );
  }

  // needs_changes (with feedback) or nothing uploaded yet — both offer the
  // same upload action, just with different supporting copy above it.
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {latestUpload?.status === "needs_changes" ? (
        <p style={{ margin: 0, fontSize: 12, color: "var(--danger)" }}>
          {latestUpload.feedback ?? "This needs a small fix. Please re-upload."}
        </p>
      ) : (
        <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>{helpText}</p>
      )}
      <button
        type="button"
        className="btn btn-secondary"
        style={{ fontSize: 13, padding: "8px 12px", alignSelf: "flex-start" }}
        onClick={() => fileInputRef.current?.click()}
      >
        <UploadCloud size={14} aria-hidden="true" /> {latestUpload ? "Replace file" : actionLabel}
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        onChange={handleFileSelected}
        style={{ display: "none" }}
        aria-label={actionLabel}
      />
    </div>
  );
}
