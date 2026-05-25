import { Easing } from "remotion";

export const EASE_OUT_EXPO = Easing.bezier(0.16, 1, 0.3, 1);
export const EASE_OUT_QUART = Easing.bezier(0.25, 1, 0.5, 1);
export const EASE_IN_OUT = Easing.inOut(EASE_OUT_QUART);
