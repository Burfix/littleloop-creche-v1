const ROLES = [
  {
    icon: "👶",
    who: "For Parents",
    title: "See your child's whole day",
    body: "From check-in to checkout, every meal, every mood, every moment — visible on your phone in real time.",
    features: ["Live daily updates", "Photo moments gallery", "Billing & payment history", "Direct chat with teachers"],
  },
  {
    icon: "👩‍🏫",
    who: "For Teachers",
    title: "Run your class without paperwork",
    body: "Digital register, meal logging, mood tracking, and photo sharing — everything in one place, done in seconds.",
    features: ["One-tap check-in", "Meal & mood logging", "Photo uploads to parents", "Daily task management"],
  },
  {
    icon: "🏫",
    who: "For Owners",
    title: "Run your business, not your inbox",
    body: "Live attendance, fee collection status, outstanding payments, and staff management — all in your cockpit.",
    features: ["Real-time attendance rate", "Revenue & outstanding fees", "Fee reminder automation", "Multi-branch support"],
  },
];

export function RoleCards() {
  return (
    <section id="roles">
      <div className="l-section-label">For everyone at your creche</div>
      <h2>
        One platform.
        <br />
        Three dashboards.
      </h2>
      <p className="l-section-sub">
        Every role gets exactly the tools they need — nothing more, nothing less.
      </p>

      <div className="l-roles-grid">
        {ROLES.map((r) => (
          <div className="l-role-card" key={r.who}>
            <div className="l-role-icon" aria-hidden="true">{r.icon}</div>
            <div className="l-role-who">{r.who}</div>
            <h3>{r.title}</h3>
            <p>{r.body}</p>
            <ul className="l-feature-list">
              {r.features.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
