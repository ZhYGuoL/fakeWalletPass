import { Iphone } from "./Iphone";

/**
 * iPhone 15 Pro mockup (SVG frame via ./Iphone) wrapping a looping
 * iMessage → Apple Wallet screen animation. Pure CSS/SVG - no video runtime.
 */

function StatusIcons() {
  return (
    <span className="ip-status__icons" aria-hidden="true">
      {/* cellular */}
      <svg viewBox="0 0 18 12" className="ip-status__cell">
        <rect x="0" y="8" width="3" height="4" rx="0.6" />
        <rect x="5" y="5.5" width="3" height="6.5" rx="0.6" />
        <rect x="10" y="3" width="3" height="9" rx="0.6" />
        <rect x="15" y="0" width="3" height="12" rx="0.6" />
      </svg>
      {/* wifi */}
      <svg viewBox="0 0 16 12" className="ip-status__wifi">
        <path d="M8 11.2 5.9 8.7a3.3 3.3 0 0 1 4.2 0L8 11.2Z" />
        <path
          d="M8 6.2c1.9 0 3.7.7 5 2M8 6.2c-1.9 0-3.7.7-5 2"
          fill="none"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <path
          d="M8 2.4c3 0 5.8 1.1 7.8 3.1M8 2.4C5 2.4 2.2 3.5.2 5.5"
          fill="none"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
      {/* battery */}
      <span className="ip-status__batt">
        <span className="ip-status__batt-fill" />
      </span>
    </span>
  );
}

function PhoneScreen() {
  return (
    <div className="ip-screen">
      <div className="ip-status">
        <span className="ip-status__time">9:41</span>
        <StatusIcons />
      </div>

      <header className="ip-header">
        <span className="ip-header__avatar" aria-hidden="true">
          K
        </span>
        <span className="ip-header__meta">
          <span className="ip-header__name">Keypass</span>
          <span className="ip-header__sub">active now</span>
        </span>
      </header>

      <div className="ip-thread" role="img" aria-label="Keypass turning a Luma link into an Apple Wallet pass">
        <div className="ip-bubble ip-bubble--sent">
          luma.com/canopy-festival-night
        </div>

        <div className="ip-typing">
          <span />
          <span />
          <span />
        </div>

        <div className="ip-bubble ip-bubble--recv">
          <span className="ip-bubble__text">
            Reading Canopy Festival… building your pass.
          </span>
          <span className="ip-bubble__bar">
            <span className="ip-bubble__bar-fill" />
          </span>
          <span className="ip-bubble__steps">Compose · Sign · Package</span>
        </div>

        <div className="ip-pass">
          <div className="ip-pass__top">
            <span className="ip-pass__title">Canopy Festival</span>
            <span className="ip-pass__brand">Wallet</span>
          </div>
          <span className="ip-pass__date">Sat · May 23 · 8:00 PM</span>
          <div className="ip-pass__grid">
            <div>
              <span className="ip-pass__k">Guest</span>
              <span className="ip-pass__v">Z. Guo</span>
            </div>
            <div>
              <span className="ip-pass__k">Pass</span>
              <span className="ip-pass__v">General · Row A</span>
            </div>
          </div>
          <div className="ip-pass__scan">
            <span className="ip-pass__qr" aria-hidden="true" />
            <span className="ip-pass__scanmeta">
              <span className="ip-pass__k">QR code</span>
              <span className="ip-pass__url">keypass.app/canopy/01</span>
              <span className="ip-pass__present">Present at entry</span>
            </span>
          </div>
          <div className="ip-pass__add">Add to Apple Wallet</div>
        </div>
      </div>

      <span className="ip-homebar" aria-hidden="true" />
    </div>
  );
}

export function HeroPhone({ reducedMotionEnabled = false, active = true }) {
  const cls = [
    "hero-iphone",
    reducedMotionEnabled ? "iphone--static" : "",
    active ? "" : "iphone--paused",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Iphone className={cls}>
      <PhoneScreen />
    </Iphone>
  );
}
