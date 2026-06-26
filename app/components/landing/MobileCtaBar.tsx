"use client";

import { useEffect, useState } from "react";

const DEMO_URL = "mailto:burfix@gmail.com?subject=LittleLoop Demo Request";

export function MobileCtaBar() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setVisible(window.scrollY > window.innerHeight * 0.8);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className={`l-mobile-cta${visible ? " is-visible" : ""}`} aria-hidden={!visible}>
      <a href={DEMO_URL} className="l-btn l-btn-primary l-mobile-cta-btn" tabIndex={visible ? 0 : -1}>
        Book a demo
      </a>
    </div>
  );
}
