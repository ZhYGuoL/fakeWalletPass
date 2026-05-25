import { useEffect, useRef, useState } from "react";
import { AgentRegisterModal } from "./AgentRegisterModal";
import { HeroPhone } from "./HeroPhone";
import { HeroQrCode } from "./HeroQrCode";
import { RemotionProcess, RemotionProcessPlaceholder } from "./RemotionProcess";
import { PlayerErrorBoundary } from "./PlayerErrorBoundary";

function useReducedMotionPreference() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return undefined;
    }
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  return reduced;
}

function usePagePhase(heroRef) {
  const [phase, setPhase] = useState("hero");
  const [layoutReady, setLayoutReady] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }

    window.scrollTo(0, 0);

    let frameId = 0;
    frameId = requestAnimationFrame(() => {
      requestAnimationFrame(() => setLayoutReady(true));
    });

    return () => cancelAnimationFrame(frameId);
  }, []);

  useEffect(() => {
    const node = heroRef.current;
    if (!node || !layoutReady || typeof window === "undefined") return undefined;

    const sync = () => {
      const rect = node.getBoundingClientRect();
      if (rect.height < 120) return;

      setPhase(rect.bottom < window.innerHeight * 0.35 ? "process" : "hero");
    };

    sync();
    window.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", sync, { passive: true });

    return () => {
      window.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
    };
  }, [heroRef, layoutReady]);

  return phase;
}

function useReveal() {
  const ref = useRef(null);
  const [seen, setSeen] = useState(
    () => typeof IntersectionObserver === "undefined",
  );

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return undefined;
    const node = ref.current;
    if (!node) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setSeen(true);
            observer.disconnect();
            return;
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -5% 0px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return [ref, seen];
}

const ACTS = [
  {
    number: "I",
    title: "Send the link.",
    body: "Drop any public Luma URL into iMessage. No app to install, no account to make. The agent treats the link as a request to enter.",
    act: "message",
  },
  {
    number: "II",
    title: "It builds the pass.",
    body: "Event metadata is scraped, the payload composed, and a signed .pkpass is generated against your local credentials.",
    act: "build",
  },
  {
    number: "III",
    title: "Add to Wallet.",
    body: "A single tap drops the pass into Apple Wallet, color-graded to the event. You walk up, you scan, you are in.",
    act: "wallet",
  },
];

const ACT_INTERVAL_MS = 5600;

function MarqueeBar() {
  const tokens = [
    "Keypass",
    "·",
    "iMessage agent",
    "·",
    "Luma → Apple Wallet",
    "·",
    "v0.2.0",
    "·",
  ];
  const repeated = [...tokens, ...tokens, ...tokens, ...tokens];
  return (
    <div className="marquee" aria-hidden="true">
      <div className="marquee__track">
        {repeated.map((token, idx) => (
          <span
            key={`${token}-${idx}`}
            className={`marquee__token ${token === "·" ? "marquee__token--dot" : ""}`}
          >
            {token}
          </span>
        ))}
      </div>
    </div>
  );
}

function Show({ reducedMotionEnabled, pagePhase, showRef, showSeen }) {
  const [active, setActive] = useState(0);
  const processActive = pagePhase === "process" && showSeen;

  useEffect(() => {
    if (reducedMotionEnabled) return undefined;
    if (typeof window === "undefined") return undefined;
    const id = window.setTimeout(() => {
      setActive((prev) => (prev + 1) % ACTS.length);
    }, ACT_INTERVAL_MS);
    return () => window.clearTimeout(id);
  }, [active, reducedMotionEnabled]);

  return (
    <section ref={showRef} className="show">
      <header className="show__head">
        <p className="kicker kicker--ember">How it works</p>
        <h2 className="display display--md">The pipeline, in three steps.</h2>
        <p className="show__lead">
          What Keypass does between your message and the door.
        </p>
      </header>

      <div className="show__tabs" role="tablist" aria-label="Keypass flow">
        {ACTS.map((act, idx) => {
          const isActive = idx === active;
          return (
            <button
              key={act.number}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`show__tab ${isActive ? "is-active" : ""}`}
              onClick={() => setActive(idx)}
            >
              <span className="show__tab-num">Step {act.number}</span>
              <span className="show__tab-title">{act.title}</span>
              <span className="show__tab-bar" aria-hidden="true">
                <span
                  className="show__tab-fill"
                  style={
                    isActive && !reducedMotionEnabled
                      ? { animationDuration: `${ACT_INTERVAL_MS}ms` }
                      : undefined
                  }
                />
              </span>
            </button>
          );
        })}
      </div>

      <div className="show__stage">
        <div className="show__copy" role="region" aria-live="polite">
          {ACTS.map((act, idx) => (
            <article
              key={act.number}
              className={`show__panel ${idx === active ? "is-active" : ""}`}
              aria-hidden={idx !== active}
            >
              <p className="show__num">Step {act.number}</p>
              <h3 className="show__title">{act.title}</h3>
              <p className="show__body">{act.body}</p>
            </article>
          ))}
        </div>

        <div className="show__viz-wrap">
          <PlayerErrorBoundary fallback={<RemotionProcessPlaceholder />}>
            {showSeen ? (
              <RemotionProcess
                phase={ACTS[active].act}
                reducedMotionEnabled={reducedMotionEnabled}
                active={processActive}
              />
            ) : (
              <RemotionProcessPlaceholder />
            )}
          </PlayerErrorBoundary>
          <p className="show__viz-cap">{active + 1} / 3 · Keypass</p>
        </div>
      </div>
    </section>
  );
}

export default function App() {
  const reducedMotionEnabled = useReducedMotionPreference();
  const heroRef = useRef(null);
  const [showRef, showSeen] = useReveal();
  const pagePhase = usePagePhase(heroRef);
  const [registerOpen, setRegisterOpen] = useState(false);

  return (
    <div className="page">
      <div className="grain" aria-hidden="true" />

      <header className="topbar">
        <div className="mark">
          <span className="mark__glyph" aria-hidden="true">
            K
          </span>
          <span className="mark__name">Keypass</span>
        </div>
        <nav className="topnav">
          <span className="topnav__edition">Vol. 02 / 2026</span>
          <a href="https://github.com" className="topnav__link" rel="noreferrer">
            Repo
          </a>
        </nav>
      </header>

      <main>
        <section ref={heroRef} className="hero">
          <PlayerErrorBoundary fallback={null}>
            <HeroQrCode />
          </PlayerErrorBoundary>
          <div className="hero__panel">
            <div className="hero__copy">
              <p className="kicker kicker--honey">An iMessage agent for Apple Wallet</p>
              <h1 className="display">
                Every door ahead of you, unlocked with one message.
              </h1>
              <p className="lede">
                Send a Luma link over iMessage. Keypass reads the event, builds
                your pass, and sends it back before you reach the door.
              </p>

              <div className="hero__cta">
                <button
                  type="button"
                  className="cta__button"
                  onClick={() => setRegisterOpen(true)}
                >
                  <span className="cta__button-label">Add Agent Number</span>
                  <span className="cta__button-icon" aria-hidden="true">
                    ↗
                  </span>
                </button>
                <p className="cta__meta hero__meta">
                  <span>Register your phone to get a line</span>
                  <span className="cta__meta-dot" aria-hidden="true">
                    ·
                  </span>
                  <span>iMessage only</span>
                </p>
              </div>
            </div>

            <div className="hero__phone">
              <HeroPhone
                reducedMotionEnabled={reducedMotionEnabled}
                active={pagePhase === "hero"}
              />
            </div>
          </div>
        </section>

        <MarqueeBar />

        <Show
          reducedMotionEnabled={reducedMotionEnabled}
          pagePhase={pagePhase}
          showRef={showRef}
          showSeen={showSeen}
        />
      </main>

      <AgentRegisterModal open={registerOpen} onClose={() => setRegisterOpen(false)} />

      <footer className="footer">
        <div className="footer__row">
          <span>© 2026 Keypass</span>
          <span>San Francisco</span>
          <span>Built quietly</span>
        </div>
        <p className="footer__fine">
          Keypass turns public Luma event pages into Apple Wallet passes over
          iMessage.
        </p>
        {import.meta.env.DEV ? (
          <p className="footer__fine footer__build" data-build="keypass-cream-v7">
            Dev · wallet-agent-site · build keypass-cream-v7
          </p>
        ) : null}
      </footer>
    </div>
  );
}
