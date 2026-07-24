import { attachment } from "spectrum-ts";
import type { Message, Space } from "spectrum-ts";

import {
  applyAnswer,
  getSession,
  isComplete,
  promptFor,
  resetSession,
  setSession,
  startDraft,
} from "./conversation.js";
import {
  acceptInboundMessage,
  idleRepliesSuppressed,
  suppressIdleReplies,
  withThreadLock,
} from "./inboundGuard.js";
import {
  BLACKLIST_MESSAGE,
  extractLumaEvent,
  findLumaUrl,
  isBlacklistedLumaUrl,
} from "./luma.js";
import { generatePkpass, trackTicketCreated } from "./pass.js";
import {
  debugMessageContent,
  inboundLumaUrl,
  inboundText,
  isLikelyLumaLinkPreview,
  shouldIgnoreInbound,
} from "./messageContent.js";

const LINK_PREVIEW_HINT = [
  "Hmm, I couldn't grab the URL from that preview.",
  "",
  "Paste the full link as plain text, like:",
  "https://luma.com/4y89vpyu",
].join("\n");

const HELP_TEXT = [
  "Hey! I'm your Luma Wallet pass agent.",
  "",
  "Send a public Luma link (lu.ma or luma.com) — I'll pull the event details, ask for anything missing, then send you a .pkpass.",
  "",
  "Commands: help · reset",
].join("\n");

function threadId(space: Space): string {
  return space.id;
}

function summaryLine(result: Awaited<ReturnType<typeof extractLumaEvent>>): string {
  const { extracted, ticketTypes } = result;
  const bits = [
    extracted.eventTitle ? `Event: ${extracted.eventTitle}` : null,
    extracted.startDateTime ? `Starts: ${extracted.startDateTime}` : null,
    extracted.address ? `Location: ${extracted.address}` : null,
    extracted.hostName ? `Host: ${extracted.hostName}` : null,
    ticketTypes.length ? `Tickets: ${ticketTypes.join(", ")}` : null,
  ].filter(Boolean);
  return bits.join("\n");
}

const deliveringPass = new Set<string>();

async function deliverPass(space: Space, session: ReturnType<typeof getSession>) {
  const id = threadId(space);
  if (deliveringPass.has(id)) {
    return;
  }

  if (session.kind !== "collecting" || !isComplete(session)) {
    await space.send("Hmm, still missing a few details — send help if you're stuck!");
    return;
  }

  deliveringPass.add(id);
  try {
    const draft = session.draft;
    const { buffer, filename } = await generatePkpass(draft);
    await space.send(
      "Here's your pass! Tap to add to Wallet.",
      attachment(Buffer.from(buffer), {
        mimeType: "application/vnd.apple.pkpass",
        name: filename,
      }),
    );
    resetSession(id);
    suppressIdleReplies(id, 15_000);
    // Bump the public leaderboard (auto-creates the listing if new).
    void trackTicketCreated(draft);
  } finally {
    deliveringPass.delete(id);
  }
}

export async function handleMessage(space: Space, message: Message): Promise<void> {
  const id = threadId(space);

  if ((message as Message & { direction?: string }).direction === "outbound") {
    return;
  }

  if (!acceptInboundMessage(message.id)) {
    if (process.env.AGENT_DEBUG === "1") {
      console.log("[agent] duplicate message id skipped", message.id);
    }
    return;
  }

  await withThreadLock(id, async () => {
    if (process.env.AGENT_DEBUG === "1") {
      console.log("[agent] inbound content:\n", debugMessageContent(message));
    }

    if (shouldIgnoreInbound(message)) {
      if (process.env.AGENT_DEBUG === "1") {
        console.log("[agent] ignored", message.content.type);
      }
      return;
    }

    const text = inboundText(message);
    if (!text) {
      return;
    }
    const lower = text.toLowerCase();

    if (lower === "help" || lower === "?") {
      await space.send(HELP_TEXT);
      return;
    }

    if (lower === "reset" || lower === "cancel") {
      resetSession(id);
      await space.send("All cleared — send a Luma link whenever you're ready!");
      return;
    }

    const lumaUrl = inboundLumaUrl(message) ?? findLumaUrl(text);
    if (lumaUrl) {
      if (isBlacklistedLumaUrl(lumaUrl)) {
        suppressIdleReplies(id, 30_000);
        await space.send(BLACKLIST_MESSAGE);
        return;
      }
      suppressIdleReplies(id, 120_000);
      await space.responding(async () => {
        try {
          const result = await extractLumaEvent(lumaUrl);
          if (!result.extracted.eventTitle || !result.extracted.startDateTime) {
            await space.send(
              "Couldn't pull enough from that page — double-check the link is public.",
            );
            return;
          }

          resetSession(id);
          const session = startDraft(id, lumaUrl, result);
          await space.send(
            ["Got it! Pulling details now!", "", summaryLine(result)].join("\n"),
          );

          if (isComplete(session)) {
            await deliverPass(space, session);
            return;
          }

          await space.send(promptFor(session));
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          await space.send(`Something went wrong fetching that page: ${msg}`);
        }
      });
      return;
    }

    const session = getSession(id);
    if (session.kind === "collecting") {
      suppressIdleReplies(id, 120_000);

      const { session: updated, invalid } = applyAnswer(session, text);
      if (updated === session && !invalid) {
        return;
      }

      setSession(id, updated);

      if (invalid) {
        await space.send(promptFor(updated));
        return;
      }

      if (isComplete(updated)) {
        await space.responding(async () => {
          await deliverPass(space, updated);
        });
        return;
      }

      await space.send(promptFor(updated));
      return;
    }

    if (isLikelyLumaLinkPreview(text)) {
      if (!idleRepliesSuppressed(id)) {
        await space.send(LINK_PREVIEW_HINT);
      }
      return;
    }

    if (idleRepliesSuppressed(id)) {
      return;
    }
  });
}
