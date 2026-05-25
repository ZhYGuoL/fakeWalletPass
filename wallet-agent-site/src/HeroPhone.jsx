import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { Player } from "@remotion/player";
import { COMPOSITION } from "./remotion/constants";
import { PhoneToPass } from "./remotion/phone-ui";

const PLAYER_STYLE = { width: "100%", height: "100%" };
const PLAYBACK_RETRIES_MS = [50, 150, 400, 800, 1500];

function HeroPhoneShell({ children }) {
  return (
    <div className="phone">
      <div className="phone__notch" aria-hidden="true" />
      <div className="phone__screen">{children}</div>
    </div>
  );
}

function kickPlayback(playerRef) {
  playerRef.current?.play();
}

function useKickPlayback(playerRef, enabled) {
  useLayoutEffect(() => {
    if (!enabled) {
      playerRef.current?.pause();
      return undefined;
    }

    kickPlayback(playerRef);
    const timers = PLAYBACK_RETRIES_MS.map((ms) =>
      window.setTimeout(() => kickPlayback(playerRef), ms),
    );

    return () => timers.forEach(clearTimeout);
  }, [enabled, playerRef]);
}

/**
 * Hero Remotion player — stays mounted; pauses when user scrolls to the show section.
 */
export function HeroPhone({ reducedMotionEnabled = false, active = true }) {
  const playerRef = useRef(null);
  const inputProps = useMemo(
    () => ({ reducedMotionEnabled }),
    [reducedMotionEnabled],
  );
  const shouldAnimate = active && !reducedMotionEnabled;

  useKickPlayback(playerRef, shouldAnimate);

  useEffect(() => {
    if (!shouldAnimate) return undefined;

    const kick = () => {
      if (document.visibilityState === "visible") {
        kickPlayback(playerRef);
      }
    };

    window.addEventListener("pageshow", kick);
    document.addEventListener("visibilitychange", kick);

    return () => {
      window.removeEventListener("pageshow", kick);
      document.removeEventListener("visibilitychange", kick);
    };
  }, [shouldAnimate]);

  return (
    <HeroPhoneShell>
      <Player
        ref={playerRef}
        component={PhoneToPass}
        {...COMPOSITION}
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
    </HeroPhoneShell>
  );
}
