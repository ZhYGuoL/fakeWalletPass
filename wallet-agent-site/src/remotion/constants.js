export const FPS = 30;
export const PHONE_WIDTH = 420;
export const PHONE_HEIGHT = 900;
export const PHONE_DURATION = 330;

/** Timeline offsets (global frames @ 30fps) */
export const TIMELINE = {
  sendBubble: 24,
  typingDots: 60,
  typingDotsDuration: 33,
  replyBubble: 96,
  passCard: 150,
};

/** Loop regions for the show-section act clips */
export const ACT_CLIPS = {
  message: { inFrame: 24, outFrame: 92 },
  build: { inFrame: 96, outFrame: 165 },
  wallet: { inFrame: 178, outFrame: 328 },
};

export const COMPOSITION = {
  fps: FPS,
  compositionWidth: PHONE_WIDTH,
  compositionHeight: PHONE_HEIGHT,
  durationInFrames: PHONE_DURATION,
};

export const PROCESS_WIDTH = 480;
export const PROCESS_HEIGHT = 360;
export const PROCESS_DURATION = 120;

export const PROCESS_COMPOSITION = {
  fps: FPS,
  compositionWidth: PROCESS_WIDTH,
  compositionHeight: PROCESS_HEIGHT,
  durationInFrames: PROCESS_DURATION,
};
