import test from "node:test";
import assert from "node:assert/strict";

import {
  acceptInboundMessage,
  idleRepliesSuppressed,
  suppressIdleReplies,
  withThreadLock,
} from "../src/inboundGuard.js";

test("acceptInboundMessage dedupes by message id", () => {
  assert.equal(acceptInboundMessage("msg-1"), true);
  assert.equal(acceptInboundMessage("msg-1"), false);
  assert.equal(acceptInboundMessage("msg-2"), true);
});

test("suppressIdleReplies blocks idle follow-ups briefly", () => {
  const thread = "chat-1";
  assert.equal(idleRepliesSuppressed(thread), false);
  suppressIdleReplies(thread, 10_000);
  assert.equal(idleRepliesSuppressed(thread), true);
});

test("withThreadLock runs handlers sequentially per thread", async () => {
  const order = [];
  await Promise.all([
    withThreadLock("chat-1", async () => {
      order.push("a-start");
      await new Promise((resolve) => setTimeout(resolve, 20));
      order.push("a-end");
    }),
    withThreadLock("chat-1", async () => {
      order.push("b");
    }),
  ]);
  assert.deepEqual(order, ["a-start", "a-end", "b"]);
});
