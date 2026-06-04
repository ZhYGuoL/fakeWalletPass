import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
} from "remotion";
import { EASE_IN_OUT, EASE_OUT_EXPO, EASE_OUT_QUART } from "./easing";

const PAPER = "oklch(0.972 0.005 95)";
const PAPER_DEEP = "oklch(0.93 0.006 95)";
const INK_SOFT = "oklch(0.5 0.013 266)";
const ACCENT = "oklch(0.5 0.16 258)";
const ACCENT_SOFT = "oklch(0.66 0.13 258)";

const NODES = [
  { id: "message", x: 72, label: "Link", color: ACCENT },
  { id: "build", x: 240, label: "Compose", color: ACCENT },
  { id: "wallet", x: 408, label: "Pass", color: ACCENT },
];

function clampInterp(frame, range, values, options = {}) {
  return interpolate(frame, range, values, {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    ...options,
  });
}

function PipelinePath({ frame, reducedMotionEnabled }) {
  const dashOffset = reducedMotionEnabled ? 0 : -(frame * 1.8) % 24;

  return (
    <svg
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      viewBox="0 0 480 360"
      aria-hidden="true"
    >
      <path
        d="M 72 180 C 140 180, 172 180, 240 180 S 340 180, 408 180"
        fill="none"
        stroke={INK_SOFT}
        strokeWidth="1.5"
        strokeDasharray="6 6"
        strokeDashoffset={dashOffset}
        opacity={0.45}
      />
    </svg>
  );
}

function FlowParticle({ frame, fromX, toX, offset, reducedMotionEnabled }) {
  if (reducedMotionEnabled) return null;

  const local = (frame + offset) % 48;
  const t = clampInterp(local, [0, 48], [0, 1], { easing: EASE_IN_OUT });
  const x = fromX + (toX - fromX) * t;
  const y = 180 + Math.sin(t * Math.PI) * -18;
  const opacity = clampInterp(local, [0, 8, 40, 48], [0, 1, 1, 0]);

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: 8,
        height: 8,
        borderRadius: 999,
        background: ACCENT,
        transform: "translate(-50%, -50%)",
        opacity,
        boxShadow: `0 0 12px ${ACCENT_SOFT}`,
      }}
    />
  );
}

function ProcessNode({ node, frame, phase, reducedMotionEnabled }) {
  const isActive = node.id === phase;
  const pulse = reducedMotionEnabled ? 1 : 1 + Math.sin(frame / 10) * 0.04;
  const activeScale = isActive ? 1.12 * pulse : 0.92;
  const ringOpacity = isActive
    ? clampInterp(frame % 60, [0, 30, 60], [0.35, 0.7, 0.35])
    : 0.12;
  const enter = clampInterp(frame, [0, 20], [24, 0], { easing: EASE_OUT_EXPO });
  const opacity = clampInterp(frame, [0, 16], [0, 1], { easing: EASE_OUT_QUART });

  return (
    <div
      style={{
        position: "absolute",
        left: node.x,
        top: 180 + enter,
        transform: `translate(-50%, -50%) scale(${activeScale})`,
        opacity,
        display: "grid",
        justifyItems: "center",
        gap: 10,
        zIndex: isActive ? 3 : 1,
      }}
    >
      <div
        style={{
          width: isActive ? 72 : 56,
          height: isActive ? 72 : 56,
          borderRadius: node.id === "wallet" ? 14 : 999,
          border: `1.5px solid ${node.color}`,
          background: isActive ? PAPER : PAPER_DEEP,
          boxShadow: isActive
            ? `0 0 0 8px oklch(0.5 0.16 258 / ${ringOpacity})`
            : "none",
          display: "grid",
          placeItems: "center",
        }}
      >
        <NodeGlyph id={node.id} frame={frame} active={isActive} reduced={reducedMotionEnabled} />
      </div>
      <span
        style={{
          fontFamily: "IBM Plex Mono, monospace",
          fontSize: 11,
          fontWeight: 500,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: isActive ? "oklch(0.24 0.012 266)" : INK_SOFT,
        }}
      >
        {node.label}
      </span>
    </div>
  );
}

function NodeGlyph({ id, frame, active, reduced }) {
  const spin = reduced ? 0 : frame * (active ? 4 : 1.5);

  if (id === "message") {
    return (
      <div
        style={{
          width: 18,
          height: 12,
          borderRadius: 6,
          border: `2px solid ${ACCENT}`,
          transform: `rotate(${active ? -8 : 0}deg)`,
        }}
      />
    );
  }

  if (id === "build") {
    const bars = [0, 1, 2].map((i) => {
      const h = reduced
        ? 12
        : clampInterp((frame + i * 8) % 24, [0, 12, 24], [8, 20, 8], {
            easing: EASE_IN_OUT,
          });
      return (
        <span
          key={i}
          style={{
            width: 4,
            height: h,
            borderRadius: 2,
            background: ACCENT,
          }}
        />
      );
    });
    return (
      <div style={{ display: "flex", gap: 4, alignItems: "flex-end", height: 20 }}>
        {bars}
      </div>
    );
  }

  return (
    <div
      style={{
        width: 22,
        height: 28,
        borderRadius: 5,
        border: `2px solid ${ACCENT}`,
        transform: `rotate(${active ? spin * 0.15 : 0}deg)`,
        background: "linear-gradient(160deg, oklch(0.96 0.01 258), oklch(0.86 0.06 258))",
      }}
    />
  );
}

function PhaseLabel({ phase, frame }) {
  const labels = {
    message: "Intent received",
    build: "Metadata → payload",
    wallet: "Ready at the gate",
  };
  const opacity = clampInterp(frame % 90, [0, 12, 78, 90], [0, 1, 1, 0], {
    easing: EASE_OUT_QUART,
  });

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 36,
        textAlign: "center",
        fontFamily: "Hanken Grotesk, sans-serif",
        fontWeight: 600,
        fontSize: 17,
        letterSpacing: "-0.01em",
        color: INK_SOFT,
        opacity,
      }}
    >
      {labels[phase]}
    </div>
  );
}

function OrbitRing({ frame, reducedMotionEnabled }) {
  if (reducedMotionEnabled) return null;

  const scale = clampInterp(frame % 120, [0, 120], [0.85, 1.05], { easing: EASE_IN_OUT });

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: 180,
        width: 320,
        height: 120,
        borderRadius: "50%",
        border: "1px solid oklch(0.5 0.013 266 / 0.18)",
        transform: `translate(-50%, -50%) scale(${scale})`,
      }}
    />
  );
}

export function ProcessFlow({ phase = "message", reducedMotionEnabled = false }) {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(90% 80% at 50% 40%, ${PAPER}, ${PAPER_DEEP})`,
        fontFamily: "Hanken Grotesk, sans-serif",
        overflow: "hidden",
      }}
    >
      <OrbitRing frame={frame} reducedMotionEnabled={reducedMotionEnabled} />
      <PipelinePath frame={frame} reducedMotionEnabled={reducedMotionEnabled} />
      <FlowParticle
        frame={frame}
        fromX={72}
        toX={240}
        offset={0}
        reducedMotionEnabled={reducedMotionEnabled}
      />
      <FlowParticle
        frame={frame}
        fromX={240}
        toX={408}
        offset={16}
        reducedMotionEnabled={reducedMotionEnabled}
      />
      <FlowParticle
        frame={frame}
        fromX={72}
        toX={408}
        offset={32}
        reducedMotionEnabled={reducedMotionEnabled}
      />
      {NODES.map((node) => (
        <ProcessNode
          key={node.id}
          node={node}
          frame={frame}
          phase={phase}
          reducedMotionEnabled={reducedMotionEnabled}
        />
      ))}
      <PhaseLabel phase={phase} frame={frame} />
    </AbsoluteFill>
  );
}
