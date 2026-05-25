import { imessage } from "spectrum-ts/providers/imessage";
import { terminal } from "spectrum-ts/providers/terminal";

export function useTerminalOnly(): boolean {
  if (process.env.USE_TERMINAL === "true") return true;
  return !process.env.PROJECT_ID || !process.env.PROJECT_SECRET;
}

export function spectrumProviders() {
  const providers = [];
  if (useTerminalOnly()) {
    providers.push(terminal.config());
  } else {
    providers.push(imessage.config());
  }
  return providers;
}

export function spectrumOptions() {
  if (useTerminalOnly()) {
    return { providers: spectrumProviders() } as const;
  }
  return {
    projectId: process.env.PROJECT_ID!,
    projectSecret: process.env.PROJECT_SECRET!,
    providers: spectrumProviders(),
  } as const;
}
