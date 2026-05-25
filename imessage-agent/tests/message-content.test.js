import test from "node:test";
import assert from "node:assert/strict";

import { findLumaUrl, normalizeLumaUrl } from "../src/luma.js";
import {
  inboundLumaUrl,
  inboundText,
  isLikelyLumaLinkPreview,
  shouldIgnoreInbound,
} from "../src/messageContent.js";

test("findLumaUrl accepts luma.com and lu.ma links", () => {
  assert.equal(
    findLumaUrl("check https://luma.com/4y89vpyu?tk=abc"),
    "https://luma.com/4y89vpyu?tk=abc",
  );
  assert.equal(findLumaUrl("https://lu.ma/festival"), "https://lu.ma/festival");
});

test("findLumaUrl accepts bare domains", () => {
  assert.equal(findLumaUrl("luma.com/4y89vpyu"), "https://luma.com/4y89vpyu");
});

test("normalizeLumaUrl adds https scheme", () => {
  assert.equal(normalizeLumaUrl("lu.ma/abc"), "https://lu.ma/abc");
});

test("inboundText reads richlink url", () => {
  const message = {
    content: {
      type: "richlink",
      url: new URL("https://luma.com/festival?tk=HRt9qb"),
    },
  };
  assert.equal(inboundText(message), "https://luma.com/festival?tk=HRt9qb");
  assert.equal(inboundLumaUrl(message), "https://luma.com/festival?tk=HRt9qb");
});

test("inboundLumaUrl reads url from group items", () => {
  const message = {
    content: {
      type: "group",
      items: [
        {
          content: { type: "text", text: "Canopy Festival · Luma" },
        },
        {
          content: {
            type: "richlink",
            url: new URL("https://luma.com/festival?tk=HRt9qb"),
          },
        },
      ],
    },
  };
  assert.equal(inboundLumaUrl(message), "https://luma.com/festival?tk=HRt9qb");
  assert.equal(shouldIgnoreInbound(message), false);
});

test("inboundLumaUrl reads url from custom raw payload", () => {
  const message = {
    content: {
      type: "custom",
      raw: {
        content: {
          text: "https://luma.com/4y89vpyu",
          balloonBundleId: "com.apple.messages.URLBalloonProvider",
        },
      },
    },
  };
  assert.equal(inboundLumaUrl(message), "https://luma.com/4y89vpyu");
  assert.equal(shouldIgnoreInbound(message), false);
});

test("shouldIgnoreInbound skips attachments without replying", () => {
  assert.equal(
    shouldIgnoreInbound({ content: { type: "attachment", mimeType: "image/jpeg" } }),
    true,
  );
});

test("isLikelyLumaLinkPreview detects unfurled titles", () => {
  assert.equal(isLikelyLumaLinkPreview("Canopy Festival · Luma"), true);
  assert.equal(isLikelyLumaLinkPreview("https://luma.com/4y89vpyu"), false);
});
