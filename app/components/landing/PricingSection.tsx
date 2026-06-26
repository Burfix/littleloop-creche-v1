const DEMO_URL = "mailto:burfix@gmail.com?subject=LittleLoop Demo Request";

const TIERS = [
  {
    name: "Starter",
    price: "R1,800",
    desc: "For a single small creche getting started.",
    features: ["Up to 40 children", "Parent & teacher apps", "Digital register", "Real-time updates"],
    featured: false,
  },
  {
    name: "Growth",
    price: "R4,500",
    desc: "For growing creches that want it all.",
    features: ["Up to 150 children", "Everything in Starter", "Multi-branch support", "Billing & fee reminders", "Priority support"],
    featured: true,
  },
  {
    name: "Enterprise",
    price: "R9,500",
    desc: "For large groups and franchises.",
    features: ["Unlimited children", "Everything in Growth", "Unlimited branches", "Dedicated onboarding", "Custom reporting"],
    featured: false,
  },
];

export function PricingSection() {
  return (
    <section className="l-pricing" id="pricing">
      <div className="l-pricing-inner">
        <div className="l-section-label l-pricing-label">Pricing</div>
        <h2 className="l-pricing-h2">Simple, monthly pricing</h2>
        <p className="l-pricing-sub">No setup fees. Month-to-month. Cancel anytime.</p>

        <div className="l-pricing-grid">
          {TIERS.map((t) => (
            <div className={`l-price-card${t.featured ? " l-price-featured" : ""}`} key={t.name}>
              {t.featured && <div className="l-price-badge">Most popular</div>}
              <div className="l-price-name">{t.name}</div>
              <div className="l-price-amount">
                {t.price}
                <span className="l-price-period">/mo</span>
              </div>
              <p className="l-price-desc">{t.desc}</p>
              <ul className="l-price-features">
                {t.features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              <a
                href={DEMO_URL}
                className={`l-btn ${t.featured ? "l-btn-primary" : "l-btn-outline"} l-price-cta`}
              >
                Book a demo
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
