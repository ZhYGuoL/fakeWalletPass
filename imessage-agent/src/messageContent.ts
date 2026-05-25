import type { Message } from "spectrum-ts";

import { findLumaUrl } from "./luma.js";

function urlToString(url: unknown): string | null {
  if (typeof url === "string") {
    const trimmed = url.trim();
    return trimmed || null;
  }
  if (url instanceof URL) {
    return url.href;
  }
  return null;
}

function extractStrings(value: unknown, depth = 0): string[] {
  if (depth > 8 || value == null) return [];
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? [trimmed] : [];
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return [String(value)];
  }
  if (value instanceof URL) {
    return [value.href];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => extractStrings(item, depth + 1));
  }
  if (typeof value === "object") {
    return Object.values(value).flatMap((item) => extractStrings(item, depth + 1));
  }
  return [];
}

function stringsFromContent(content: Message["content"]): string[] {
  switch (content.type) {
    case "text":
      return content.text.trim() ? [content.text] : [];
    case "richlink": {
      const href = urlToString(content.url);
      return href ? [href] : [];
    }
    case "group":
      return content.items.flatMap((item) => stringsFromMessage(item as Message));
    case "custom":
      return extractStrings(content.raw);
    case "reply":
      return stringsFromContent(content.content as Message["content"]);
    default:
      return [];
  }
}

function stringsFromMessage(message: Message): string[] {
  return stringsFromContent(message.content);
}

/** True when iMessage sent an unfurled link bubble title instead of the raw URL. */
export function isLikelyLumaLinkPreview(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (/·\s*Luma\s*$/i.test(trimmed)) return true;
  if (/[\u00b7\u2022]\s*luma/i.test(trimmed) && !findLumaUrl(trimmed)) return true;
  return false;
}

/** Plain user text for commands and follow-up answers (not deep extraction). */
export function inboundText(message: Message): string | null {
  const content = message.content;
  if (content.type === "text") {
    const text = content.text.trim();
    return text || null;
  }
  if (content.type === "group") {
    for (const item of content.items) {
      const text = inboundText(item as Message);
      if (text) return text;
    }
    return null;
  }
  if (content.type === "richlink") {
    return urlToString(content.url);
  }
  return null;
}

export function inboundLumaUrl(message: Message): string | null {
  for (const candidate of stringsFromMessage(message)) {
    const url = findLumaUrl(candidate);
    if (url) return url;
  }
  return null;
}

/** Skip typing indicators, tapbacks, OG image attachments, etc. */
export function shouldIgnoreInbound(message: Message): boolean {
  if (inboundLumaUrl(message)) return false;

  const { type } = message.content;
  if (type === "text") {
    return message.content.text.trim().length === 0;
  }
  if (
    type === "attachment" ||
    type === "typing" ||
    type === "reaction" ||
    type === "group" ||
    type === "custom" ||
    type === "richlink"
  ) {
    return true;
  }
  return true;
}

export function debugMessageContent(message: Message): string {
  return JSON.stringify(
    message,
    (_key, value) => {
      if (typeof value === "function") return "[Function]";
      if (value instanceof URL) return value.href;
      if (value instanceof Buffer) return `[Buffer ${value.length}b]`;
      return value;
    },
    2,
  );
}
