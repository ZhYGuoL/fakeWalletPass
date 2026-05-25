import { useEffect, useMemo, useRef, useState } from "react";
import { Player } from "@remotion/player";
import { ACT_CLIPS, COMPOSITION } from "./remotion/constants";
import { PhoneToPass } from "./remotion/phone-ui";

const PLAYER_STYLE = { width: "100%", height: "100%" };

function useInView({ enabled = true, threshold = 0.1, rootMargin = "0px" } = {}) {
  const ref = useRef(null);
  const [inView, setInView] = useState(() => !enabled);

  useEffect(() => {
    if (!enabled) {
      setInView(true);
      return undefined;
    }

    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return undefined;
    }

    const node = ref.current;
    if (!node) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          setInView(entry.isIntersecting);
        }
      },
      { threshold, rootMargin },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [enabled, threshold, rootMargin]);

  return [ref, inView];
}

/**
 * Remotion-backed phone mockup.
 * Hero mode mounts immediately when active. Other modes lazy-load via inView.
 */
export function RemotionPhone({
  mode = "hero",
  act,
  reducedMotionEnabled = false,
  active = true,
}) {
  const isHero = mode === "hero";
  const [attachRef, inView] = useInView({ enabled: !isHero });
  const playerRef = useRef(null);
  const [instanceId] = useState(() => Math.random().toString(36).slice(2));
  const clip = mode === "act" && act ? ACT_CLIPS[act] : null;
  const shouldRenderPlayer = active && (isHero || inView);
  const shouldAnimate = shouldRenderPlayer && !reducedMotionEnabled;

  const inputProps = useMemo(
    () => ({ reducedMotionEnabled }),
    [reducedMotionEnabled],
  );

  const playerKey = `${mode === "act" ? `act-${act}` : "hero"}-${instanceId}`;

  useEffect(() => {
    if (!shouldAnimate || !shouldRenderPlayer) return undefined;

    const timers = [0, 16, 48, 120, 300, 600].map((delay) =>
      window.setTimeout(() => {
        playerRef.current?.play();
      }, delay),
    );

    return () => timers.forEach(clearTimeout);
  }, [shouldAnimate, shouldRenderPlayer, playerKey]);

  return (
    <div ref={attachRef} className="phone">
      <div className="phone__notch" aria-hidden="true" />
      <div className="phone__screen">
        {shouldRenderPlayer ? (
          <Player
            ref={playerRef}
            key={playerKey}
            component={PhoneToPass}
            {...COMPOSITION}
            inputProps={inputProps}
            initialFrame={clip?.inFrame ?? 0}
            inFrame={clip?.inFrame ?? undefined}
            outFrame={clip?.outFrame ?? undefined}
            style={PLAYER_STYLE}
            controls={false}
            autoPlay={shouldAnimate}
            loop={shouldAnimate}
            numberOfSharedAudioTags={0}
            noSuspense
            clickToPlay={false}
            showVolumeControls={false}
            moveToBeginningWhenEnded
          />
        ) : null}
      </div>
    </div>
  );
}

export function RemotionPhonePlaceholder() {
  return (
    <div className="phone phone--placeholder" aria-hidden="true">
      <div className="phone__notch" />
      <div className="phone__screen" />
    </div>
  );
}
