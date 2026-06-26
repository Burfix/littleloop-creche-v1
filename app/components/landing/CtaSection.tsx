const DEMO_URL = "mailto:burfix@gmail.com?subject=LittleLoop Demo Request";
const LOGIN_URL = "https://littleloop-creche-v1.vercel.app/login";

export function CtaSection() {
  return (
    <section className="l-cta-wrap" aria-label="Get started">
      <div className="l-section-label l-cta-label">Ready to get started?</div>
      <h2>
        Your creche deserves
        <br />
        <em>better tools.</em>
      </h2>
      <p>Join the growing network of South African creches on LittleLoop. Setup takes one day.</p>
      <div className="l-cta-actions">
        <a href={DEMO_URL} className="l-btn l-btn-primary l-btn-lg">Book a free demo</a>
        <a href={LOGIN_URL} className="l-btn l-btn-outline l-btn-lg">See the live app</a>
      </div>
    </section>
  );
}
