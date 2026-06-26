import { PhoneMockup } from "./PhoneMockup";

const DEMO_URL = "mailto:burfix@gmail.com?subject=LittleLoop Demo Request";
const LOGIN_URL = "https://littleloop-creche-v1.vercel.app/login";

export function HeroSection() {
  return (
    <section className="l-hero" id="top">
      <div className="l-hero-text">
        <div className="l-eyebrow">Built for South African creches</div>
        <h1>Every parent deserves to <em>know</em></h1>
        <p className="l-hero-sub">
          LittleLoop replaces WhatsApp chaos and paper registers with one real-time
          platform — a parent portal, teacher toolkit, and owner cockpit. Mobile-first,
          no downloads, ready in a day.
        </p>
        <div className="l-hero-actions">
          <a href={DEMO_URL} className="l-btn l-btn-primary">Book a free demo →</a>
          <a href={LOGIN_URL} className="l-btn l-btn-outline">See it live</a>
        </div>
        <div className="l-hero-trust">
          <div className="l-avatar-stack" aria-hidden="true">
            <div className="l-av">P</div>
            <div className="l-av">K</div>
            <div className="l-av">S</div>
            <div className="l-av">M</div>
          </div>
          <div className="l-trust-text">
            <strong>Trusted by early adopters</strong>
            <br />
            Piloting with leading Cape Town creches
          </div>
        </div>
      </div>

      <div className="l-hero-visual">
        <div className="l-phone-wrap l-float">
          <div className="l-float-badge l-badge-1">
            <span className="l-icon" aria-hidden="true">😊</span>
            <div>
              Mia is happy today
              <small>Just now · Toddlers class</small>
            </div>
          </div>

          <div className="l-float-badge l-badge-2">
            <span className="l-icon" aria-hidden="true">🍽️</span>
            <div>
              Lunch: all eaten
              <small>12:30 PM</small>
            </div>
          </div>

          <PhoneMockup />
        </div>
      </div>
    </section>
  );
}
