import { LandingNav } from "./LandingNav";
import { HeroSection } from "./HeroSection";
import { ProblemSolution } from "./ProblemSolution";
import { HowItWorks } from "./HowItWorks";
import { RoleCards } from "./RoleCards";
import { FeaturesGrid } from "./FeaturesGrid";
import { PricingSection } from "./PricingSection";
import { TestimonialSection } from "./TestimonialSection";
import { FaqSection } from "./FaqSection";
import { CtaSection } from "./CtaSection";
import { LandingFooter } from "./LandingFooter";
import { MobileCtaBar } from "./MobileCtaBar";

const LANDING_CSS = `
  body:has(.landing) { background: #FFF8F0 !important; }
  .landing {
    max-width: none !important;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    background: #FFF8F0;
    color: #1A2E3B;
    -webkit-font-smoothing: antialiased;
    min-height: 100vh;
    --l-navy:   #1A2E3B;
    --l-green:  #4F9B7A;
    --l-green2: #3A7A5E;
    --l-cream:  #FFF8F0;
    --l-mint:   #F0F7F4;
    --l-yellow: #FFD166;
    --l-muted:  #6B8A99;
    --l-border: #DDE8E3;
    --l-r: 16px;
  }
  .landing * { box-sizing: border-box; margin: 0; padding: 0; }
  .landing a { text-decoration: none; }
  .landing :focus-visible { outline: 3px solid var(--l-green); outline-offset: 2px; border-radius: 6px; }

  /* ── BUTTONS ── */
  .landing .l-btn {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 11px 24px; border-radius: 999px;
    font-size: 14px; font-weight: 600;
    border: none; cursor: pointer;
    transition: transform .15s, opacity .15s;
    font-family: inherit; white-space: nowrap;
  }
  .landing .l-btn:hover { opacity: .9; transform: translateY(-1px); }
  .landing .l-btn-primary { background: var(--l-green); color: #fff; }
  .landing .l-btn-outline { background: transparent; color: var(--l-navy); border: 1.5px solid var(--l-border); }
  .landing .l-btn-lg { padding: 14px 32px; font-size: 16px; }

  /* ── NAV ── */
  .landing .l-nav {
    position: sticky; top: 0; z-index: 100;
    display: flex; align-items: center; justify-content: space-between;
    padding: 16px 48px;
    background: rgba(255,248,240,0.92);
    backdrop-filter: blur(12px);
    border-bottom: 1px solid var(--l-border);
  }
  .landing .l-logo {
    display: flex; align-items: center; gap: 10px;
    font-family: 'Fraunces', Georgia, serif; font-weight: 600; font-size: 22px;
    color: var(--l-navy);
  }
  .landing .l-logo-icon {
    width: 36px; height: 36px; border-radius: 10px; background: var(--l-green);
    display: flex; align-items: center; justify-content: center; font-size: 18px;
  }
  .landing .l-nav-links { display: flex; align-items: center; gap: 32px; }
  .landing .l-nav-links a { color: var(--l-muted); font-size: 14px; font-weight: 500; transition: color .2s; }
  .landing .l-nav-links a:hover { color: var(--l-navy); }
  .landing .l-nav-actions { display: flex; gap: 10px; }
  .landing .l-hamburger {
    display: none; background: transparent; border: none; color: var(--l-navy);
    cursor: pointer; padding: 6px; align-items: center; justify-content: center;
  }
  .landing .l-mobile-menu {
    position: absolute; top: 100%; left: 0; right: 0;
    background: var(--l-cream); border-bottom: 1px solid var(--l-border);
    display: flex; flex-direction: column; gap: 14px; padding: 24px 32px;
  }
  .landing .l-mobile-menu a:not(.l-btn) { color: var(--l-navy); font-size: 16px; font-weight: 500; }
  .landing .l-mobile-menu .l-btn { justify-content: center; }

  /* ── HERO ── */
  .landing .l-hero {
    display: grid; grid-template-columns: 1fr 1fr; gap: 0;
    min-height: 90vh; align-items: center;
    padding: 80px 48px; max-width: 1200px; margin: 0 auto;
  }
  .landing .l-hero-text { padding-right: 48px; }
  .landing .l-eyebrow {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 6px 14px; border-radius: 999px;
    background: var(--l-mint); border: 1px solid var(--l-border);
    font-size: 12px; font-weight: 600; color: var(--l-green2);
    letter-spacing: .5px; text-transform: uppercase; margin-bottom: 28px;
  }
  .landing .l-eyebrow::before { content: ''; width: 6px; height: 6px; border-radius: 50%; background: var(--l-green); }
  .landing h1 {
    font-family: 'Fraunces', Georgia, serif;
    font-size: clamp(38px, 4.5vw, 58px); font-weight: 600;
    line-height: 1.1; letter-spacing: -1px; margin-bottom: 24px; color: var(--l-navy);
  }
  .landing h1 em { font-style: italic; color: var(--l-green); }
  .landing .l-hero-sub { font-size: 17px; line-height: 1.65; color: var(--l-muted); margin-bottom: 40px; max-width: 460px; }
  .landing .l-hero-actions { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
  .landing .l-hero-trust { margin-top: 48px; display: flex; align-items: center; gap: 16px; }
  .landing .l-avatar-stack { display: flex; }
  .landing .l-av {
    width: 36px; height: 36px; border-radius: 50%;
    border: 2px solid var(--l-cream); margin-left: -10px;
    display: flex; align-items: center; justify-content: center;
    font-size: 14px; font-weight: 600; background: var(--l-green); color: #fff;
  }
  .landing .l-av:first-child { margin-left: 0; }
  .landing .l-trust-text { font-size: 13px; color: var(--l-muted); line-height: 1.4; }
  .landing .l-trust-text strong { color: var(--l-navy); }

  /* ── PHONE ── */
  .landing .l-hero-visual { display: flex; justify-content: center; align-items: center; position: relative; }
  .landing .l-phone-wrap { position: relative; }
  .landing .l-phone {
    width: 300px; background: var(--l-navy); border-radius: 44px; padding: 12px;
    box-shadow: 0 40px 80px rgba(26,46,59,0.25), 0 0 0 1px rgba(26,46,59,0.1);
  }
  .landing .l-phone-inner { background: #f8fafc; border-radius: 34px; overflow: hidden; height: 580px; position: relative; }
  .landing .l-phone-status { background: var(--l-green); padding: 14px 20px 10px; color: #fff; }
  .landing .l-phone-status-top { display: flex; justify-content: space-between; align-items: center; font-size: 11px; margin-bottom: 14px; opacity: .8; }
  .landing .l-phone-header { display: flex; align-items: center; justify-content: space-between; }
  .landing .l-phone-header-left p { font-size: 11px; opacity: .75; margin-bottom: 2px; }
  .landing .l-phone-header-left h3 { font-size: 17px; font-weight: 700; }
  .landing .l-phone-avatar { width: 34px; height: 34px; border-radius: 50%; background: rgba(255,255,255,0.2); display: flex; align-items: center; justify-content: center; font-size: 16px; }
  .landing .l-phone-card-row { display: grid; grid-template-columns: 1fr 1fr 1fr; padding: 14px 0 0; text-align: center; }
  .landing .l-phone-card-row div { display: flex; flex-direction: column; gap: 2px; }
  .landing .l-phone-card-row .val { font-size: 20px; font-weight: 700; }
  .landing .l-phone-card-row .lbl { font-size: 10px; opacity: .7; }
  .landing .l-phone-body { padding: 14px; display: flex; flex-direction: column; gap: 10px; }
  .landing .l-phone-section-title { font-size: 12px; font-weight: 700; color: var(--l-navy); margin-bottom: 2px; }
  .landing .l-phone-update-card { background: #fff; border-radius: 12px; padding: 12px; border: 1px solid var(--l-border); }
  .landing .l-phone-meal-row { display: flex; justify-content: space-between; align-items: center; font-size: 11px; margin-bottom: 6px; }
  .landing .l-pill-sm { padding: 2px 8px; border-radius: 999px; font-size: 10px; font-weight: 600; }
  .landing .l-pill-green { background: #dcfce7; color: #166534; }
  .landing .l-pill-amber { background: #fef9c3; color: #854d0e; }
  .landing .l-phone-note { background: #f0f7f4; border-radius: 10px; padding: 10px; font-size: 10px; color: #3a7a5e; line-height: 1.5; border-left: 3px solid var(--l-green); }
  .landing .l-phone-activity-row { display: flex; gap: 6px; flex-wrap: wrap; }
  .landing .l-activity-tag { background: var(--l-mint); color: var(--l-green2); padding: 3px 9px; border-radius: 999px; font-size: 10px; font-weight: 600; }
  .landing .l-phone-nav { position: absolute; bottom: 0; left: 0; right: 0; background: #fff; border-top: 1px solid var(--l-border); display: flex; padding: 10px 0 14px; }
  .landing .l-phone-nav-item { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 3px; font-size: 9px; color: var(--l-muted); }
  .landing .l-phone-nav-item.active { color: var(--l-green); }
  .landing .l-phone-nav-item .l-icon { font-size: 16px; }

  .landing .l-float-badge {
    position: absolute; background: #fff; border-radius: 14px; padding: 10px 14px;
    box-shadow: 0 8px 24px rgba(26,46,59,0.12);
    display: flex; align-items: center; gap: 10px;
    font-size: 12px; font-weight: 600; color: var(--l-navy); white-space: nowrap; z-index: 2;
  }
  .landing .l-float-badge .l-icon { font-size: 20px; }
  .landing .l-float-badge small { font-size: 10px; font-weight: 400; color: var(--l-muted); display: block; }
  .landing .l-badge-1 { top: 60px; left: -70px; }
  .landing .l-badge-2 { bottom: 120px; right: -60px; }

  /* ── SECTIONS ── */
  .landing section { padding: 100px 48px; max-width: 1200px; margin: 0 auto; }
  .landing .l-section-label { font-size: 12px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; color: var(--l-green); margin-bottom: 16px; }
  .landing h2 { font-family: 'Fraunces', Georgia, serif; font-size: clamp(30px, 3.5vw, 44px); font-weight: 600; line-height: 1.15; letter-spacing: -.5px; color: var(--l-navy); margin-bottom: 16px; }
  .landing h2 em { font-style: italic; color: var(--l-green); }
  .landing .l-section-sub { font-size: 17px; color: var(--l-muted); line-height: 1.6; max-width: 520px; }

  /* ── PROBLEM → SOLUTION ── */
  .landing .l-ps { max-width: none; padding: 0; }
  .landing .l-ps-inner { background: var(--l-navy); padding: 90px 48px; }
  .landing .l-ps-label { color: var(--l-yellow); text-align: center; }
  .landing .l-ps-h2 { color: #fff; text-align: center; max-width: 700px; margin: 0 auto 56px; }
  .landing .l-ps-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; max-width: 1100px; margin: 0 auto; }
  .landing .l-ps-card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 20px; padding: 28px 24px; text-align: center; }
  .landing .l-ps-problem { color: rgba(255,255,255,0.55); font-size: 15px; display: flex; align-items: center; justify-content: center; gap: 8px; }
  .landing .l-ps-x { color: #f87171; font-weight: 700; }
  .landing .l-ps-arrow { color: var(--l-green); font-size: 22px; margin: 14px 0; }
  .landing .l-ps-solution { color: #fff; font-size: 16px; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 8px; }
  .landing .l-ps-check { color: var(--l-green); font-weight: 700; }

  /* ── HOW IT WORKS ── */
  .landing .l-how-wrap { background: var(--l-mint); border-radius: 32px; padding: 64px 60px; }
  .landing .l-how-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2px; margin-top: 56px; }
  .landing .l-how-card { background: #fff; padding: 36px 32px; transition: transform .2s; }
  .landing .l-how-card:first-child { border-radius: 24px 0 0 24px; }
  .landing .l-how-card:last-child { border-radius: 0 24px 24px 0; }
  .landing .l-how-card:hover { transform: translateY(-4px); }
  .landing .l-how-num { font-family: 'Fraunces', Georgia, serif; font-size: 48px; font-weight: 300; color: var(--l-green); opacity: .35; line-height: 1; margin-bottom: 16px; }
  .landing .l-how-card h3 { font-size: 18px; font-weight: 600; margin-bottom: 10px; color: var(--l-navy); }
  .landing .l-how-card p { font-size: 14px; color: var(--l-muted); line-height: 1.65; }

  /* ── ROLES ── */
  .landing .l-roles-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-top: 56px; }
  .landing .l-role-card { border-radius: 24px; padding: 36px 28px; border: 1.5px solid var(--l-border); background: #fff; transition: border-color .2s, box-shadow .2s; }
  .landing .l-role-card:hover { border-color: var(--l-green); box-shadow: 0 8px 32px rgba(79,155,122,.1); }
  .landing .l-role-icon { font-size: 36px; margin-bottom: 20px; }
  .landing .l-role-card h3 { font-size: 18px; font-weight: 600; margin-bottom: 8px; color: var(--l-navy); }
  .landing .l-role-who { font-size: 12px; color: var(--l-green); font-weight: 600; margin-bottom: 14px; }
  .landing .l-role-card p { font-size: 14px; color: var(--l-muted); line-height: 1.65; margin-bottom: 16px; }
  .landing .l-feature-list { list-style: none; display: flex; flex-direction: column; gap: 8px; }
  .landing .l-feature-list li { font-size: 13px; color: var(--l-navy); display: flex; align-items: center; gap: 8px; }
  .landing .l-feature-list li::before { content: '✓'; color: var(--l-green); font-weight: 700; font-size: 12px; }

  /* ── FEATURES GRID ── */
  .landing .l-features-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-top: 56px; }
  .landing .l-feature-card { background: #fff; border: 1.5px solid var(--l-border); border-radius: 20px; padding: 32px 28px; transition: border-color .2s, box-shadow .2s; }
  .landing .l-feature-card:hover { border-color: var(--l-green); box-shadow: 0 8px 32px rgba(79,155,122,.1); }
  .landing .l-feature-icon { width: 48px; height: 48px; border-radius: 14px; background: var(--l-mint); color: var(--l-green2); display: flex; align-items: center; justify-content: center; margin-bottom: 18px; }
  .landing .l-feature-card h3 { font-size: 17px; font-weight: 600; margin-bottom: 8px; color: var(--l-navy); }
  .landing .l-feature-card p { font-size: 14px; color: var(--l-muted); line-height: 1.6; }

  /* ── PRICING ── */
  .landing .l-pricing { max-width: none; padding: 0; }
  .landing .l-pricing-inner { background: var(--l-navy); padding: 90px 48px; }
  .landing .l-pricing-label { color: var(--l-yellow); text-align: center; }
  .landing .l-pricing-h2 { color: #fff; text-align: center; }
  .landing .l-pricing-sub { text-align: center; color: rgba(255,255,255,0.6); font-size: 16px; margin-bottom: 56px; }
  .landing .l-pricing-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; max-width: 1080px; margin: 0 auto; align-items: start; }
  .landing .l-price-card { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 24px; padding: 36px 30px; color: #fff; position: relative; }
  .landing .l-price-featured { background: #fff; color: var(--l-navy); transform: scale(1.04); box-shadow: 0 30px 60px rgba(0,0,0,0.25); }
  .landing .l-price-badge { position: absolute; top: -13px; left: 50%; transform: translateX(-50%); background: var(--l-yellow); color: var(--l-navy); font-size: 11px; font-weight: 700; padding: 5px 16px; border-radius: 999px; letter-spacing: .5px; text-transform: uppercase; }
  .landing .l-price-name { font-size: 14px; font-weight: 600; opacity: .8; margin-bottom: 8px; }
  .landing .l-price-featured .l-price-name { opacity: 1; color: var(--l-green2); }
  .landing .l-price-amount { font-family: 'Fraunces', Georgia, serif; font-size: 40px; font-weight: 600; margin-bottom: 6px; }
  .landing .l-price-period { font-size: 15px; font-weight: 400; opacity: .6; font-family: 'Inter', sans-serif; }
  .landing .l-price-desc { font-size: 14px; opacity: .7; margin-bottom: 24px; line-height: 1.5; }
  .landing .l-price-features { list-style: none; display: flex; flex-direction: column; gap: 10px; margin-bottom: 28px; }
  .landing .l-price-features li { font-size: 14px; display: flex; align-items: center; gap: 8px; }
  .landing .l-price-features li::before { content: '✓'; color: var(--l-green); font-weight: 700; }
  .landing .l-price-cta { width: 100%; justify-content: center; }
  .landing .l-price-card:not(.l-price-featured) .l-btn-outline { color: #fff; border-color: rgba(255,255,255,0.25); }

  /* ── TESTIMONIAL ── */
  .landing .l-testimonial-section { padding-top: 0; padding-bottom: 100px; }
  .landing .l-testimonial-wrap { background: var(--l-mint); border-radius: 32px; padding: 80px 60px; text-align: center; }
  .landing .l-testimonial-wrap blockquote { font-family: 'Fraunces', Georgia, serif; font-style: italic; font-size: clamp(20px, 2.5vw, 28px); font-weight: 300; color: var(--l-navy); line-height: 1.5; max-width: 700px; margin: 0 auto 32px; }
  .landing .l-testimonial-credit { display: flex; align-items: center; justify-content: center; gap: 14px; }
  .landing .l-testimonial-av { width: 48px; height: 48px; border-radius: 50%; background: var(--l-green); display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 700; font-size: 18px; }
  .landing .l-testimonial-name { font-weight: 600; font-size: 14px; }
  .landing .l-testimonial-title { font-size: 13px; color: var(--l-muted); }

  /* ── FAQ ── */
  .landing .l-faq-list { margin-top: 48px; max-width: 760px; display: flex; flex-direction: column; gap: 12px; }
  .landing .l-faq-item { background: #fff; border: 1.5px solid var(--l-border); border-radius: 16px; overflow: hidden; transition: border-color .2s; }
  .landing .l-faq-item.is-open { border-color: var(--l-green); }
  .landing .l-faq-q { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 20px 24px; background: transparent; border: none; cursor: pointer; font-family: inherit; font-size: 16px; font-weight: 600; color: var(--l-navy); text-align: left; }
  .landing .l-faq-chev { color: var(--l-green); transition: transform .2s; flex-shrink: 0; }
  .landing .l-faq-item.is-open .l-faq-chev { transform: rotate(180deg); }
  .landing .l-faq-a { padding: 0 24px 22px; font-size: 15px; color: var(--l-muted); line-height: 1.6; }

  /* ── CTA ── */
  .landing .l-cta-wrap { text-align: center; padding: 100px 48px 120px; }
  .landing .l-cta-label { text-align: center; }
  .landing .l-cta-wrap h2 { font-size: clamp(36px, 5vw, 60px); margin-bottom: 16px; }
  .landing .l-cta-wrap p { color: var(--l-muted); font-size: 17px; margin-bottom: 40px; }
  .landing .l-cta-actions { display: flex; justify-content: center; gap: 16px; flex-wrap: wrap; }

  /* ── FOOTER ── */
  .landing .l-footer { border-top: 1px solid var(--l-border); padding: 40px 48px; display: flex; align-items: center; justify-content: space-between; font-size: 13px; color: var(--l-muted); max-width: 1200px; margin: 0 auto; flex-wrap: wrap; gap: 20px; }
  .landing .l-footer a { color: var(--l-muted); }
  .landing .l-footer a:hover { color: var(--l-navy); }
  .landing .l-footer-logo { font-size: 16px; }
  .landing .l-footer-logo-icon { width: 28px; height: 28px; font-size: 14px; }
  .landing .l-footer-links { display: flex; gap: 28px; flex-wrap: wrap; }

  /* ── MOBILE STICKY CTA ── */
  .landing .l-mobile-cta {
    position: fixed; bottom: 0; left: 0; right: 0; z-index: 200;
    padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
    background: rgba(255,248,240,0.95); backdrop-filter: blur(12px);
    border-top: 1px solid var(--l-border);
    transform: translateY(120%); transition: transform .3s ease;
    display: none;
  }
  .landing .l-mobile-cta.is-visible { transform: translateY(0); }
  .landing .l-mobile-cta-btn { width: 100%; justify-content: center; padding: 14px; }

  /* ── ANIMATIONS ── */
  @keyframes l-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-12px)} }
  @keyframes l-fadein { from{opacity:0;transform:scale(.9)} to{opacity:1;transform:scale(1)} }
  .landing .l-float { animation: l-float 4s ease-in-out infinite; }
  .landing .l-badge-1 { animation: l-fadein 1s .5s both; }
  .landing .l-badge-2 { animation: l-fadein 1s 1s both; }
  @media (prefers-reduced-motion: reduce) {
    .landing .l-float, .landing .l-badge-1, .landing .l-badge-2 { animation: none; }
  }

  /* ── RESPONSIVE ── */
  @media (max-width: 900px) {
    .landing .l-nav { padding: 14px 24px; }
    .landing .l-nav-links, .landing .l-nav-actions { display: none; }
    .landing .l-hamburger { display: inline-flex; }
    .landing .l-hero { grid-template-columns: 1fr; padding: 56px 24px 40px; text-align: center; min-height: auto; gap: 56px; }
    .landing .l-hero-text { padding-right: 0; }
    .landing .l-hero-sub { margin: 0 auto 40px; }
    .landing .l-hero-actions, .landing .l-hero-trust { justify-content: center; }
    .landing .l-hero-visual { order: -1; }
    .landing .l-badge-1, .landing .l-badge-2 { display: none; }
    .landing section { padding: 60px 24px; }
    .landing .l-ps-inner, .landing .l-pricing-inner { padding: 60px 24px; }
    .landing .l-how-wrap { padding: 40px 24px; }
    .landing .l-how-grid, .landing .l-roles-grid, .landing .l-features-grid, .landing .l-ps-grid, .landing .l-pricing-grid { grid-template-columns: 1fr; gap: 16px; }
    .landing .l-how-card:first-child, .landing .l-how-card:last-child { border-radius: 24px; }
    .landing .l-price-featured { transform: none; }
    .landing .l-testimonial-wrap { padding: 48px 24px; }
    .landing .l-footer { flex-direction: column; text-align: center; }
    .landing .l-mobile-cta { display: block; }
  }
`;

export function LandingPage() {
  return (
    <div className="landing">
      <style dangerouslySetInnerHTML={{ __html: LANDING_CSS }} />
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link
        href="https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,300;0,600;0,700;1,300;1,600&display=swap"
        rel="stylesheet"
      />

      <LandingNav />
      <main>
        <HeroSection />
        <ProblemSolution />
        <HowItWorks />
        <RoleCards />
        <FeaturesGrid />
        <PricingSection />
        <TestimonialSection />
        <FaqSection />
        <CtaSection />
      </main>
      <LandingFooter />
      <MobileCtaBar />
    </div>
  );
}
