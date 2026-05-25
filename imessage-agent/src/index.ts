import { Spectrum } from "spectrum-ts";

import { handleMessage } from "./agent.js";
import { spectrumOptions, useTerminalOnly } from "./config.js";
import { prepareAgentProcess } from "./env.js";

async function main(): Promise<void> {
  prepareAgentProcess();

  const mode = useTerminalOnly() ? "terminal (local dev)" : "iMessage (Photon Spectrum Cloud)";
  console.log(`Starting Luma pass agent — ${mode}`);
  if (process.env.AGENT_DEBUG === "1") {
    console.log("AGENT_DEBUG=1 — logging raw inbound message content");
  }

  const app = await Spectrum(spectrumOptions());

  process.on("SIGINT", () => {
    void app.stop().finally(() => process.exit(0));
  });

  for await (const [space, message] of app.messages) {
    try {
      await handleMessage(space, message);
    } catch (error) {
      console.error("handler error:", error);
      await space.send("Sorry — something broke on my side. Try again or send reset.");
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
