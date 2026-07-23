import { useEffect, useRef, useState } from "react";
import { AgentRegisterModal } from "./AgentRegisterModal";
import { HeroPhone } from "./HeroPhone";
import { HeroQrCode } from "./HeroQrCode";
import { Pipeline, PipelinePlaceholder } from "./Pipeline";
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

const SPEC_ITEMS = [
  "iMessage only",
  "Luma → Apple Wallet",
  "Signed .pkpass",
  "No app to install",
];

function formatUsd(amount) {
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

// Pulls metrics from /api/stats. No figures are baked into the bundle; the
// displayed value is whatever the server returns at fetch time. Retries with
// backoff so a single failed load (e.g. a dev-server restart) can't strand the
// leaderboard on skeletons.
function useLiveStats() {
  const [saved, setSaved] = useState(null);
  const [events, setEvents] = useState(null);

  useEffect(() => {
    let alive = true;
    let attempt = 0;
    let timer;

    const pull = async () => {
      try {
        const res = await fetch(`/api/stats?t=${Date.now()}`, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!alive) return;
        if (typeof data?.saved?.amount === "number") setSaved(data.saved.amount);
        const list = data?.events ?? data?.mostCopied;
        if (Array.isArray(list) && list.length > 0) {
          setEvents(list);
          return;
        }
        throw new Error("no events in response");
      } catch {
        if (!alive) return;
        attempt += 1;
        if (attempt <= 8) {
          timer = window.setTimeout(pull, Math.min(3000, 400 * attempt));
        }
      }
    };

    pull();

    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, []);

  return { saved, events };
}

function EventCarousel({ events }) {
  const trackRef = useRef(null);

  const scrollByCard = (dir) => {
    const track = trackRef.current;
    if (!track) return;
    const card = track.querySelector(".sneak__item");
    const amount = card ? card.offsetWidth + 20 : track.clientWidth * 0.8;
    track.scrollBy({ left: dir * amount, behavior: "smooth" });
  };

  return (
    <section id="sneak" className="sneak">
      <header className="sneak__head">
        <div className="sneak__intro">
          <p className="kicker kicker--accent">Tickets created · YC Startup School</p>
          <h2 className="display display--md">See where founders are getting in.</h2>
        </div>
        <div className="sneak__nav">
          <button
            type="button"
            className="sneak__arrow"
            aria-label="Previous events"
            onClick={() => scrollByCard(-1)}
          >
            ←
          </button>
          <button
            type="button"
            className="sneak__arrow"
            aria-label="Next events"
            onClick={() => scrollByCard(1)}
          >
            →
          </button>
        </div>
      </header>

      <ul ref={trackRef} className="sneak__track">
        {events
          ? events.map((evt) => (
              <li key={evt.url} className="sneak__item">
                <a
                  className="sneak__card"
                  href={evt.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  <div className="sneak__card-top">
                    <span className="sneak__rank">{evt.rank}</span>
                    <span className="sneak__copied">
                      {(evt.ticketsCreated ?? evt.copied ?? 0).toLocaleString("en-US")} tickets
                    </span>
                  </div>
                  <h3 className="sneak__name">{evt.name}</h3>
                  <p className="sneak__host">{evt.host}</p>
                  <div className="sneak__perf" aria-hidden="true" />
                  <div className="sneak__card-foot">
                    <span className="sneak__loc">{evt.location}</span>
                    <span className="sneak__chip">{evt.status}</span>
                  </div>
                  <span className="sneak__view">
                    View on Luma <span aria-hidden="true">↗</span>
                  </span>
                </a>
              </li>
            ))
          : Array.from({ length: 4 }).map((_, idx) => (
              <li key={idx} className="sneak__item" aria-hidden="true">
                <div className="sneak__card sneak__card--skeleton">
                  <div className="sneak__card-top">
                    <span className="sneak__skel sneak__skel--rank" />
                    <span className="sneak__skel sneak__skel--pill" />
                  </div>
                  <span className="sneak__skel sneak__skel--title" />
                  <span className="sneak__skel sneak__skel--line" />
                  <div className="sneak__perf" />
                  <div className="sneak__card-foot">
                    <span className="sneak__skel sneak__skel--line" />
                  </div>
                </div>
              </li>
            ))}
      </ul>
    </section>
  );
}

function SpecStrip() {
  return (
    <div className="spec">
      <ul className="spec__list">
        {SPEC_ITEMS.map((item, idx) => (
          <li key={item} className="spec__item">
            <span className="spec__index" aria-hidden="true">
              {String(idx + 1).padStart(2, "0")}
            </span>
            {item}
          </li>
        ))}
      </ul>
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
    <section ref={showRef} id="how" className="show">
      <header className="show__head">
        <p className="kicker">How it works</p>
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
          <PlayerErrorBoundary fallback={<PipelinePlaceholder />}>
            {showSeen ? (
              <Pipeline
                phase={ACTS[active].act}
                reducedMotionEnabled={reducedMotionEnabled}
                active={processActive}
              />
            ) : (
              <PipelinePlaceholder />
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
  const { saved, events } = useLiveStats();

  return (
    <div className="page">
      <header className="topbar">
        <div className="mark">
          <span className="mark__glyph" aria-hidden="true">
            K
          </span>
          <span className="mark__name">Keypass</span>
        </div>
        <nav className="topnav">
          <a href="#how" className="topnav__link">
            How it works
          </a>
          <a
            href="https://github.com/zhyguol"
            className="topnav__link"
            target="_blank"
            rel="noreferrer"
          >
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
              <p className="kicker kicker--accent">An iMessage agent for Apple Wallet</p>
              <h1 className="display">
                Text a link. Skip the line.
              </h1>
              <p className="lede">
                Send a Luma link over iMessage and Keypass turns it into a Wallet
                pass, so you can get into events without paying or being invited.
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
                <a href="#how" className="cta__button cta__button--ghost">
                  <span className="cta__button-label">How it works</span>
                </a>
              </div>
              <p className="cta__meta hero__meta">
                <span>Register your phone to get a line</span>
                <span className="cta__meta-dot" aria-hidden="true">
                  ·
                </span>
                <span>iMessage only</span>
              </p>

              <div className="hero__savings" aria-live="polite">
                {saved == null ? (
                  <span
                    className="hero__savings-fig hero__savings-fig--loading"
                    aria-hidden="true"
                  />
                ) : (
                  <span className="hero__savings-fig">{formatUsd(saved)}</span>
                )}
                <span className="hero__savings-label">
                  saved for members in event fees so far.
                </span>
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

        <SpecStrip />

        <EventCarousel events={events} />

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
          <span className="footer__mark">Keypass</span>
          <a href="#how" className="footer__link">
            How it works
          </a>
          <a
            href="https://github.com/zhyguol"
            className="footer__link"
            target="_blank"
            rel="noreferrer"
          >
            Repo
          </a>
          <span className="footer__year">© 2026</span>
        </div>
        <p className="footer__fine">
          Keypass turns public Luma event pages into Apple Wallet passes over
          iMessage.
        </p>
        {import.meta.env.DEV ? (
          <p className="footer__build" data-build="keypass-pass-v8">
            Dev · wallet-agent-site · build keypass-pass-v8
          </p>
        ) : null}
      </footer>
    </div>
  );
}
