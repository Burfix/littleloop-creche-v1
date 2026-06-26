const ITEMS = [
  {
    problem: "WhatsApp groups buzzing at 10pm",
    solution: "Instant updates in the app",
  },
  {
    problem: "Paper registers and lost slips",
    solution: "Digital check-in, one tap",
  },
  {
    problem: "No idea how the day really went",
    solution: "Full day visible before pickup",
  },
];

export function ProblemSolution() {
  return (
    <section className="l-ps" aria-label="Problem and solution">
      <div className="l-ps-inner">
        <div className="l-section-label l-ps-label">From chaos to clarity</div>
        <h2 className="l-ps-h2">The old way is exhausting. There&apos;s a better one.</h2>
        <div className="l-ps-grid">
          {ITEMS.map((it) => (
            <div className="l-ps-card" key={it.problem}>
              <p className="l-ps-problem">
                <span className="l-ps-x" aria-hidden="true">✕</span>
                {it.problem}
              </p>
              <div className="l-ps-arrow" aria-hidden="true">↓</div>
              <p className="l-ps-solution">
                <span className="l-ps-check" aria-hidden="true">✓</span>
                {it.solution}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
