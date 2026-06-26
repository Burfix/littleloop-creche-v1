"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

const FAQS = [
  { q: "How long does setup take?", a: "One day. We handle onboarding." },
  { q: "Do teachers need training?", a: "No training needed. Teachers are up in minutes." },
  { q: "What about data security?", a: "Stored securely. POPIA compliant. You own your data." },
  { q: "Can we use multiple branches?", a: "Yes. Growth and Enterprise include multi-branch." },
  { q: "Do parents need to download an app?", a: "No download. LittleLoop opens in their browser." },
  { q: "What's the contract?", a: "Month-to-month. Cancel anytime. No setup fees." },
];

export function FaqSection() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="l-faq">
      <div className="l-section-label">FAQ</div>
      <h2>Questions, answered</h2>
      <p className="l-section-sub">Everything you need to know before you book a demo.</p>

      <div className="l-faq-list">
        {FAQS.map((item, i) => {
          const isOpen = open === i;
          return (
            <div className={`l-faq-item${isOpen ? " is-open" : ""}`} key={item.q}>
              <button
                type="button"
                className="l-faq-q"
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? null : i)}
              >
                <span>{item.q}</span>
                <ChevronDown className="l-faq-chev" size={20} aria-hidden="true" />
              </button>
              {isOpen && <div className="l-faq-a">{item.a}</div>}
            </div>
          );
        })}
      </div>
    </section>
  );
}
