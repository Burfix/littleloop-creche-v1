import { Bell, Camera, ClipboardCheck, Shield, GitBranch, CreditCard } from "lucide-react";

const FEATURES = [
  { Icon: Bell, title: "Real-time updates", body: "Parents see meals, mood, naps and notes the moment they're logged." },
  { Icon: Camera, title: "Photo moments", body: "Teachers share photos straight to the right parents, securely." },
  { Icon: ClipboardCheck, title: "Digital register", body: "One-tap check-in and checkout. No paper, no lost slips." },
  { Icon: Shield, title: "POPIA compliant", body: "Data stored securely in line with South African privacy law." },
  { Icon: GitBranch, title: "Multi-branch", body: "Run several locations from one owner cockpit." },
  { Icon: CreditCard, title: "Billing built in", body: "Track fees, payments and outstanding balances at a glance." },
];

export function FeaturesGrid() {
  return (
    <section id="features">
      <div className="l-section-label">Everything in one place</div>
      <h2>
        Powerful where it counts.
        <br />
        Simple where it matters.
      </h2>
      <p className="l-section-sub">
        The features creches actually use, every single day.
      </p>

      <div className="l-features-grid">
        {FEATURES.map(({ Icon, title, body }) => (
          <div className="l-feature-card" key={title}>
            <div className="l-feature-icon" aria-hidden="true">
              <Icon size={22} aria-hidden="true" />
            </div>
            <h3>{title}</h3>
            <p>{body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
