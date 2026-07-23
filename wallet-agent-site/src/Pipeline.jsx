/**
 * Pipeline visual - one concrete mini-scene per step, mirroring the phone:
 *   Link    → a Luma URL typing into an iMessage bubble
 *   Compose → pass fields populating with a progress bar
 *   Pass    → a finished Apple Wallet card
 * Scenes cross-fade when the active step changes. Pure CSS/SVG.
 */

function LinkScene() {
  return (
    <div className="pf pf--link">
      <div className="pf__bubble">
        <span className="pf__bubble-url">luma.com/canopy-festival-night</span>
      </div>
      <span className="pf__meta">Delivered · iMessage</span>
    </div>
  );
}

function ComposeScene() {
  return (
    <div className="pf pf--compose">
      <div className="pf__doc">
        <div className="pf__doc-head">
          <span className="pf__doc-dot" />
          Building pass
        </div>
        <div className="pf__field">
          <span className="pf__field-k">Event</span>
          <span className="pf__field-v" />
        </div>
        <div className="pf__field">
          <span className="pf__field-k">Guest</span>
          <span className="pf__field-v" />
        </div>
        <div className="pf__field">
          <span className="pf__field-k">Seat</span>
          <span className="pf__field-v" />
        </div>
        <div className="pf__bar">
          <span className="pf__bar-fill" />
        </div>
      </div>
    </div>
  );
}

function PassScene() {
  return (
    <div className="pf pf--pass">
      <div className="pf__pass">
        <div className="pf__pass-top">
          <span className="pf__pass-name">Canopy Festival</span>
          <span className="pf__pass-brand">Wallet</span>
        </div>
        <div className="pf__pass-row">
          <span className="pf__pass-qr" aria-hidden="true" />
          <div className="pf__pass-info">
            <span className="pf__pass-k">General · Row A</span>
            <span className="pf__pass-url">keypass.app/canopy/01</span>
          </div>
        </div>
        <div className="pf__pass-add">Ready at the gate</div>
      </div>
    </div>
  );
}

const SCENES = {
  message: LinkScene,
  build: ComposeScene,
  wallet: PassScene,
};

export function Pipeline({ phase = "message", reducedMotionEnabled = false, active = true }) {
  if (!active) {
    return <div className="process-frame process-frame--placeholder" aria-hidden="true" />;
  }

  const Scene = SCENES[phase] ?? LinkScene;
  const cls = ["process-frame", "pflow", reducedMotionEnabled ? "pflow--static" : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cls} data-phase={phase}>
      <div className="pflow__stage" key={phase}>
        <Scene />
      </div>
    </div>
  );
}

export function PipelinePlaceholder() {
  return <div className="process-frame process-frame--placeholder" aria-hidden="true" />;
}
