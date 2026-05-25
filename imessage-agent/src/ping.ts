/**
 * Register your phone with Photon (required on shared plans), then send an opening iMessage.
 * Usage: npm run ping -- +14124754173
 *
 * Run `npm run dev` in another terminal first so replies are handled.
 */
import { Spectrum } from "spectrum-ts";
import { imessage } from "spectrum-ts/providers/imessage";

import { spectrumOptions, useTerminalOnly } from "./config.js";
import { prepareAgentProcess } from "./env.js";
import { registerSharedUser } from "./register.js";

async function main(): Promise<void> {
  prepareAgentProcess();

  const phone = process.argv[2]?.trim();
  if (!phone) {
    console.error("Usage: npm run ping -- +14124754173");
    process.exit(1);
  }

  if (useTerminalOnly()) {
    console.error("Set USE_TERMINAL=false in .env to ping over iMessage.");
    process.exit(1);
  }

  const user = await registerSharedUser(phone);
  console.log(`Registered. Your agent line is ${user.assignedPhoneNumber}`);

  const app = await Spectrum(spectrumOptions());
  const im = imessage(app);
  const recipient = await im.user(phone);
  const dm = await im.space(recipient);

  await dm.send(
    [
      "Hey! Your Luma Wallet pass agent is live.",
      "",
      "Send a public Luma link (lu.ma or luma.com) and I'll build you a pass.",
    ].join("\n"),
  );

  console.log(`Ping sent to ${phone}. Reply in that iMessage thread.`);
  console.log(`You can also text ${user.assignedPhoneNumber} directly anytime.`);
  await app.stop();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
