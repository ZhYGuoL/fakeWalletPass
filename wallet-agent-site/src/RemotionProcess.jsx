import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { Player } from "@remotion/player";
import { PROCESS_COMPOSITION } from "./remotion/constants";
import { ProcessFlow } from "./remotion/process-flow";

const PLAYER_STYLE = { width: "100%", height: "100%" };

function startPlayback(playerRef) {
  playerRef.current?.play();
}

export function RemotionProcess({ phase, reducedMotionEnabled = false, active = true }) {
  const playerRef = useRef(null);
  const inputProps = useMemo(
    () => ({ phase, reducedMotionEnabled }),
    [phase, reducedMotionEnabled],
  );
  const shouldAnimate = active && !reducedMotionEnabled;

  useLayoutEffect(() => {
    if (!shouldAnimate) return undefined;

    startPlayback(playerRef);
    const timers = [50, 150, 400, 800].map((ms) =>
      window.setTimeout(() => startPlayback(playerRef), ms),
    );

    return () => timers.forEach(clearTimeout);
  }, [shouldAnimate, phase]);

  if (!active) {
    return <div className="process-frame process-frame--placeholder" aria-hidden="true" />;
  }

  return (
    <div className="process-frame">
      <Player
        ref={playerRef}
        component={ProcessFlow}
        {...PROCESS_COMPOSITION}
        inputProps={inputProps}
        style={PLAYER_STYLE}
        controls={false}
        autoPlay={shouldAnimate}
        loop={shouldAnimate}
        initiallyMuted
        numberOfSharedAudioTags={0}
        acknowledgeRemotionLicense
        noSuspense
        clickToPlay={false}
        showVolumeControls={false}
        moveToBeginningWhenEnded
        showPosterWhenUnplayed={false}
      />
    </div>
  );
}

export function RemotionProcessPlaceholder() {
  return <div className="process-frame process-frame--placeholder" aria-hidden="true" />;
}
