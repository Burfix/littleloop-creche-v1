const STEPS = [
  {
    num: "01",
    title: "You onboard your school",
    body: "We set up your school in minutes. Add your classes, invite teachers and parents — they get an email and set their own password.",
  },
  {
    num: "02",
    title: "Teachers run the day",
    body: "Check children in, log meals, mood, and nap time. Post moments. Tick off tasks. All from their phone, in real time.",
  },
  {
    num: "03",
    title: "Parents stay connected",
    body: "Every parent sees their child's full day as it happens — no waiting for a WhatsApp message or a paper note at pickup.",
  },
];

export function HowItWorks() {
  return (
    <section id="how">
      <div className="l-how-wrap">
        <div className="l-section-label">How it works</div>
        <h2>
          Set up in a day.
          <br />
          Used every day.
        </h2>
        <p className="l-section-sub">
          LittleLoop is designed for creche owners who don&apos;t have time for complexity.
        </p>

        <div className="l-how-grid">
          {STEPS.map((s) => (
            <div className="l-how-card" key={s.num}>
              <div className="l-how-num">{s.num}</div>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
