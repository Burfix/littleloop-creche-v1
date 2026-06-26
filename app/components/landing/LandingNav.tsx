"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";

const LOGIN_URL = "https://littleloop-creche-v1.vercel.app/login";
const DEMO_URL = "mailto:burfix@gmail.com?subject=LittleLoop Demo Request";

export function LandingNav() {
  const [open, setOpen] = useState(false);

  return (
    <nav className="l-nav" aria-label="Primary">
      <a href="#top" className="l-logo">
        <span className="l-logo-icon" aria-hidden="true">🌱</span>
        LittleLoop
      </a>

      <div className="l-nav-links">
        <a href="#how">How it works</a>
        <a href="#roles">For everyone</a>
        <a href="#pricing">Pricing</a>
        <a href="#faq">FAQ</a>
      </div>

      <div className="l-nav-actions">
        <a href={LOGIN_URL} className="l-btn l-btn-outline">Sign in</a>
        <a href={DEMO_URL} className="l-btn l-btn-primary">Book a demo</a>
      </div>

      <button
        type="button"
        className="l-hamburger"
        aria-label="Toggle navigation"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}
      </button>

      {open && (
        <div className="l-mobile-menu">
          <a href="#how" onClick={() => setOpen(false)}>How it works</a>
          <a href="#roles" onClick={() => setOpen(false)}>For everyone</a>
          <a href="#pricing" onClick={() => setOpen(false)}>Pricing</a>
          <a href="#faq" onClick={() => setOpen(false)}>FAQ</a>
          <a href={LOGIN_URL} className="l-btn l-btn-outline">Sign in</a>
          <a href={DEMO_URL} className="l-btn l-btn-primary">Book a demo</a>
        </div>
      )}
    </nav>
  );
}
