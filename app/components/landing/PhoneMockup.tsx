export function PhoneMockup() {
  return (
    <div className="l-phone" aria-label="LittleLoop parent dashboard preview" role="img">
      <div className="l-phone-inner">
        <div className="l-phone-status">
          <div className="l-phone-status-top">
            <span>9:41 AM</span>
            <span aria-hidden="true">●●●</span>
          </div>
          <div className="l-phone-header">
            <div className="l-phone-header-left">
              <p>Wednesday, 25 June</p>
              <h3>Pebblestones 🌸</h3>
            </div>
            <div className="l-phone-avatar" aria-hidden="true">👤</div>
          </div>
          <div className="l-phone-card-row">
            <div><span className="val">😊</span><span className="lbl">Mood</span></div>
            <div><span className="val">45m</span><span className="lbl">Nap</span></div>
            <div><span className="val">3/3</span><span className="lbl">Meals</span></div>
          </div>
        </div>

        <div className="l-phone-body">
          <div>
            <div className="l-phone-section-title">Meals today</div>
            <div className="l-phone-update-card">
              <div className="l-phone-meal-row"><span>Breakfast</span><span className="l-pill-sm l-pill-green">All eaten</span></div>
              <div className="l-phone-meal-row"><span>Lunch</span><span className="l-pill-sm l-pill-green">All eaten</span></div>
              <div className="l-phone-meal-row" style={{ marginBottom: 0 }}><span>Snack</span><span className="l-pill-sm l-pill-amber">Partly eaten</span></div>
            </div>
          </div>

          <div>
            <div className="l-phone-section-title">Teacher note</div>
            <div className="l-phone-note">Mia had a wonderful day! She really enjoyed finger painting and made a friend in circle time. 🎨</div>
          </div>

          <div>
            <div className="l-phone-section-title">Activities</div>
            <div className="l-phone-activity-row">
              <span className="l-activity-tag">Finger painting</span>
              <span className="l-activity-tag">Story time</span>
              <span className="l-activity-tag">Outdoor play</span>
            </div>
          </div>
        </div>

        <div className="l-phone-nav" aria-hidden="true">
          <div className="l-phone-nav-item active"><div className="l-icon">🏠</div>Home</div>
          <div className="l-phone-nav-item"><div className="l-icon">📷</div>Moments</div>
          <div className="l-phone-nav-item"><div className="l-icon">💳</div>Billing</div>
          <div className="l-phone-nav-item"><div className="l-icon">💬</div>Chat</div>
        </div>
      </div>
    </div>
  );
}
