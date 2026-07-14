"use client";

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
}

export function SectionHeader({ title, subtitle }: SectionHeaderProps) {
  return (
    <div>
      <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.4px" }}>
        {title}
      </p>
      {subtitle && <p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--text-muted)" }}>{subtitle}</p>}
    </div>
  );
}
