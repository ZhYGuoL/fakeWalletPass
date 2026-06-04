import {
  AbsoluteFill,
  Sequence,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { TIMELINE } from "./constants";
import { EASE_IN_OUT, EASE_OUT_EXPO, EASE_OUT_QUART } from "./easing";
import {
  ACCENT,
  BUBBLE_RECV,
  BUBBLE_SEND,
  MUTED,
  PAPER,
  PAPER_SOFT,
  RULE,
  SCREEN_BG,
  SCREEN_BG_TOP,
} from "./theme";

function clampInterp(frame, range, values, options = {}) {
  return interpolate(frame, range, values, {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    ...options,
  });
}

export function AmbientGlow({ reducedMotionEnabled }) {
  const frame = useCurrentFrame();
  if (reducedMotionEnabled) return null;

  const x = clampInterp(frame % 210, [0, 105, 210], [10, 80, 10], {
    easing: EASE_IN_OUT,
  });
  const y = clampInterp(frame % 210, [0, 105, 210], [20, 60, 20], {
    easing: EASE_IN_OUT,
  });

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: `radial-gradient(120% 80% at ${x}% ${y}%, oklch(0.6 0.16 258 / 0.2), transparent 60%)`,
        zIndex: 0,
      }}
    />
  );
}

export function StatusBar() {
  const frame = useCurrentFrame();
  const opacity = clampInterp(frame, [0, 18], [0, 1], { easing: EASE_OUT_QUART });

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: 64,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "14px 30px 0",
        color: PAPER,
        fontFamily: "IBM Plex Mono, monospace",
        fontSize: 17,
        fontWeight: 500,
        letterSpacing: "0.01em",
        opacity,
        zIndex: 5,
      }}
    >
      <span>9:41</span>
      <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
        <span style={{ display: "inline-flex", gap: 3 }}>
          <span style={{ width: 4, height: 6, background: PAPER, borderRadius: 1 }} />
          <span style={{ width: 4, height: 9, background: PAPER, borderRadius: 1 }} />
          <span style={{ width: 4, height: 12, background: PAPER, borderRadius: 1 }} />
          <span style={{ width: 4, height: 15, background: PAPER, borderRadius: 1 }} />
        </span>
        <span
          style={{
            width: 28,
            height: 13,
            border: `1px solid ${PAPER}`,
            borderRadius: 4,
            position: "relative",
          }}
        >
          <span
            style={{
              position: "absolute",
              top: 2,
              left: 2,
              right: 6,
              bottom: 2,
              background: PAPER,
              borderRadius: 2,
            }}
          />
          <span
            style={{
              position: "absolute",
              top: 4,
              right: -3,
              width: 2,
              height: 5,
              background: PAPER,
              borderRadius: 1,
            }}
          />
        </span>
      </span>
    </div>
  );
}

export function ThreadHeader() {
  const frame = useCurrentFrame();
  const opacity = clampInterp(frame, [0, 18], [0, 1], { easing: EASE_OUT_QUART });

  return (
    <div
      style={{
        position: "absolute",
        top: 64,
        left: 0,
        right: 0,
        padding: "16px 24px 14px",
        borderBottom: `1px solid ${RULE}`,
        display: "flex",
        alignItems: "center",
        gap: 12,
        background: SCREEN_BG_TOP,
        opacity,
        zIndex: 4,
      }}
    >
      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: 10,
          background: `linear-gradient(160deg, ${ACCENT}, oklch(0.48 0.16 258))`,
          color: PAPER,
          display: "grid",
          placeItems: "center",
          fontFamily: "Hanken Grotesk, sans-serif",
          fontWeight: 800,
          fontSize: 21,
          lineHeight: 1,
        }}
      >
        K
      </div>
      <div style={{ display: "grid", gap: 2 }}>
        <span
          style={{
            color: PAPER,
            fontFamily: "Hanken Grotesk, sans-serif",
            fontSize: 19,
            fontWeight: 700,
            letterSpacing: "-0.01em",
          }}
        >
          Keypass
        </span>
        <span
          style={{
            color: MUTED,
            fontFamily: "IBM Plex Mono, monospace",
            fontSize: 12.5,
            letterSpacing: "0.02em",
          }}
        >
          active now
        </span>
      </div>
    </div>
  );
}

export function SendBubble({ reducedMotionEnabled }) {
  const frame = useCurrentFrame();
  const scale = reducedMotionEnabled ? 0.5 : 1;
  const enter = clampInterp(frame, [0, 20], [40 * scale, 0], { easing: EASE_OUT_EXPO });
  const opacity = clampInterp(frame, [0, 16], [0, 1], { easing: EASE_OUT_QUART });

  return (
    <div
      style={{
        position: "absolute",
        top: 178,
        right: 22,
        maxWidth: 280,
        padding: "12px 16px",
        borderRadius: "22px 22px 6px 22px",
        background: BUBBLE_SEND,
        color: PAPER,
        fontFamily: "IBM Plex Mono, monospace",
        fontSize: 14.5,
        lineHeight: 1.4,
        transform: `translateY(${enter}px)`,
        opacity,
        boxShadow: "0 10px 24px oklch(0 0 0 / 0.4)",
        zIndex: 3,
      }}
    >
      luma.com/canopy-festival-night
    </div>
  );
}

export function TypingDots({ reducedMotionEnabled }) {
  const frame = useCurrentFrame();
  const local = frame % 30;
  const baseScale = reducedMotionEnabled ? 0.6 : 1;
  const bounce = (offset) =>
    clampInterp(Math.max(0, local - offset), [0, 6, 14, 22], [0.4, 1, 0.4, 0.4], {
      easing: EASE_IN_OUT,
    });

  const dot = (s) => ({
    width: 8,
    height: 8,
    borderRadius: 999,
    background: PAPER_SOFT,
    transform: `scale(${0.55 + s * 0.45 * baseScale})`,
  });

  return (
    <div
      style={{
        position: "absolute",
        top: 254,
        left: 22,
        padding: "10px 16px",
        borderRadius: "22px 22px 22px 6px",
        background: BUBBLE_RECV,
        display: "inline-flex",
        gap: 6,
        alignItems: "center",
        zIndex: 3,
      }}
    >
      <span style={dot(bounce(0))} />
      <span style={dot(bounce(4))} />
      <span style={dot(bounce(8))} />
    </div>
  );
}

export function ReplyBubble({ reducedMotionEnabled }) {
  const frame = useCurrentFrame();
  const scale = reducedMotionEnabled ? 0.5 : 1;
  const enter = clampInterp(frame, [0, 18], [30 * scale, 0], { easing: EASE_OUT_EXPO });
  const opacity = clampInterp(frame, [0, 14], [0, 1], { easing: EASE_OUT_QUART });
  const progress = clampInterp(frame, [6, 60], [0, 100], { easing: EASE_IN_OUT });

  return (
    <div
      style={{
        position: "absolute",
        top: 254,
        left: 22,
        maxWidth: 300,
        padding: "14px 18px 16px",
        borderRadius: "22px 22px 22px 6px",
        background: BUBBLE_RECV,
        color: PAPER,
        fontFamily: "Hanken Grotesk, sans-serif",
        fontSize: 15.5,
        lineHeight: 1.45,
        transform: `translateY(${enter}px)`,
        opacity,
        zIndex: 3,
      }}
    >
      <div>Reading Canopy Festival… building your pass.</div>
      <div
        style={{
          marginTop: 12,
          height: 4,
          borderRadius: 999,
          background: "oklch(0.32 0.01 60)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${progress}%`,
            height: "100%",
            background: ACCENT,
          }}
        />
      </div>
      <div
        style={{
          marginTop: 8,
          fontFamily: "IBM Plex Mono, monospace",
          fontSize: 11,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          color: MUTED,
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <span>Compose · sign · package</span>
        <span>{Math.round(progress)}%</span>
      </div>
    </div>
  );
}

export function PassCard({ reducedMotionEnabled }) {
  const frame = useCurrentFrame();
  const scale = reducedMotionEnabled ? 0.4 : 1;
  const enter = clampInterp(frame, [0, 28], [180 * scale, 0], { easing: EASE_OUT_EXPO });
  const opacity = clampInterp(frame, [0, 22], [0, 1], { easing: EASE_OUT_QUART });
  const settledFrame = Math.max(0, frame - 28);
  const tilt = reducedMotionEnabled
    ? 0
    : clampInterp(settledFrame % 160, [0, 80, 160], [-1.2, 1.2, -1.2], {
        easing: EASE_IN_OUT,
      });

  return (
    <div
      style={{
        position: "absolute",
        bottom: 28,
        left: 22,
        right: 22,
        padding: 20,
        borderRadius: 22,
        background:
          "linear-gradient(160deg, oklch(0.98 0.006 258) 0%, oklch(0.94 0.02 258) 55%, oklch(0.9 0.045 258) 100%)",
        color: "oklch(0.22 0.01 266)",
        boxShadow:
          "0 30px 60px oklch(0 0 0 / 0.5), inset 0 0 0 1px oklch(1 0 0 / 0.5)",
        transform: `translateY(${enter}px) rotate(${tilt}deg)`,
        opacity,
        zIndex: 3,
        fontFamily: "Hanken Grotesk, sans-serif",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span
          style={{
            fontFamily: "Hanken Grotesk, sans-serif",
            fontWeight: 800,
            fontSize: 21,
            letterSpacing: "-0.02em",
          }}
        >
          Canopy Festival
        </span>
        <span
          style={{
            fontFamily: "IBM Plex Mono, monospace",
            fontSize: 10.5,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "oklch(0.5 0.16 258)",
          }}
        >
          Wallet
        </span>
      </div>
      <div
        style={{
          marginTop: 6,
          fontFamily: "IBM Plex Mono, monospace",
          fontSize: 12.5,
          color: "oklch(0.44 0.012 266)",
          letterSpacing: "0.01em",
        }}
      >
        Sat · May 23 · 8:00 PM
      </div>

      <div
        style={{
          marginTop: 16,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 14,
          fontSize: 13,
        }}
      >
        <div>
          <div
            style={{
              fontFamily: "IBM Plex Mono, monospace",
              fontSize: 10,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "oklch(0.46 0.014 266)",
            }}
          >
            Guest
          </div>
          <div style={{ marginTop: 2, fontSize: 15, fontWeight: 600 }}>Z. Guo</div>
        </div>
        <div>
          <div
            style={{
              fontFamily: "IBM Plex Mono, monospace",
              fontSize: 10,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "oklch(0.46 0.014 266)",
            }}
          >
            Pass
          </div>
          <div style={{ marginTop: 2, fontSize: 15, fontWeight: 600 }}>General · Row A</div>
        </div>
      </div>

      <div
        style={{
          marginTop: 18,
          height: 86,
          borderRadius: 14,
          background: "oklch(0.99 0.004 266)",
          padding: 10,
          display: "grid",
          gridTemplateColumns: "86px 1fr",
          gap: 14,
          alignItems: "center",
        }}
      >
        <div
          style={{
            width: 66,
            height: 66,
            borderRadius: 8,
            background:
              "repeating-conic-gradient(oklch(0.18 0.01 266) 0 25%, oklch(0.99 0.004 266) 0 50%)",
            backgroundSize: "8px 8px",
            border: "1px solid oklch(0.86 0.008 266)",
          }}
        />
        <div style={{ display: "grid", gap: 4 }}>
          <span
            style={{
              fontFamily: "IBM Plex Mono, monospace",
              fontSize: 10,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "oklch(0.48 0.012 266)",
            }}
          >
            QR code
          </span>
          <span
            style={{
              fontFamily: "IBM Plex Mono, monospace",
              fontSize: 12.5,
              color: "oklch(0.44 0.14 258)",
              fontWeight: 500,
            }}
          >
            keypass.app/canopy/01
          </span>
          <span
            style={{
              fontFamily: "IBM Plex Mono, monospace",
              fontSize: 11,
              color: "oklch(0.48 0.012 266)",
            }}
          >
            Present at entry
          </span>
        </div>
      </div>

      <div
        style={{
          marginTop: 14,
          padding: "11px 14px",
          borderRadius: 10,
          background: "oklch(0.2 0.012 266)",
          color: PAPER,
          fontFamily: "Hanken Grotesk, sans-serif",
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: "0.02em",
          textTransform: "none",
          textAlign: "center",
          boxShadow: "inset 0 0 0 1px oklch(0.62 0.16 258 / 0.5)",
        }}
      >
        Add to Apple Wallet
      </div>
    </div>
  );
}

export function HomeIndicator() {
  return (
    <div
      style={{
        position: "absolute",
        bottom: 8,
        left: "50%",
        transform: "translateX(-50%)",
        width: 110,
        height: 4,
        borderRadius: 999,
        background: PAPER_SOFT,
        opacity: 0.6,
        zIndex: 6,
      }}
    />
  );
}

export function PhoneToPass({ reducedMotionEnabled = false }) {
  const { fps } = useVideoConfig();
  const premount = fps;

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(180deg, ${SCREEN_BG_TOP}, ${SCREEN_BG})`,
        fontFamily: "Hanken Grotesk, sans-serif",
        overflow: "hidden",
      }}
    >
      <Sequence premountFor={premount}>
        <AmbientGlow reducedMotionEnabled={reducedMotionEnabled} />
      </Sequence>

      <Sequence premountFor={premount}>
        <StatusBar />
      </Sequence>

      <Sequence from={4} premountFor={premount} layout="none">
        <ThreadHeader />
      </Sequence>

      <Sequence from={TIMELINE.sendBubble} premountFor={premount} layout="none">
        <SendBubble reducedMotionEnabled={reducedMotionEnabled} />
      </Sequence>

      <Sequence
        from={TIMELINE.typingDots}
        durationInFrames={TIMELINE.typingDotsDuration}
        premountFor={premount}
        layout="none"
      >
        <TypingDots reducedMotionEnabled={reducedMotionEnabled} />
      </Sequence>

      <Sequence from={TIMELINE.replyBubble} premountFor={premount} layout="none">
        <ReplyBubble reducedMotionEnabled={reducedMotionEnabled} />
      </Sequence>

      <Sequence from={TIMELINE.passCard} premountFor={premount} layout="none">
        <PassCard reducedMotionEnabled={reducedMotionEnabled} />
      </Sequence>

      <Sequence premountFor={premount}>
        <HomeIndicator />
      </Sequence>
    </AbsoluteFill>
  );
}
