const seenMessageIds = new Set<string>();
const suppressIdleUntil = new Map<string, number>();
const threadLocks = new Map<string, Promise<void>>();

const SEEN_CAP = 300;

function pruneSeen(): void {
  if (seenMessageIds.size <= SEEN_CAP) return;
  seenMessageIds.clear();
}

/** Drop duplicate Spectrum deliveries of the same message id. */
export function acceptInboundMessage(messageId: string): boolean {
  if (seenMessageIds.has(messageId)) {
    return false;
  }
  seenMessageIds.add(messageId);
  pruneSeen();
  return true;
}

/** Ignore stray follow-up iMessage fragments (preview titles, duplicate parts). */
export function suppressIdleReplies(threadId: string, ms: number): void {
  const until = Date.now() + ms;
  const current = suppressIdleUntil.get(threadId) ?? 0;
  suppressIdleUntil.set(threadId, Math.max(current, until));
}

export function idleRepliesSuppressed(threadId: string): boolean {
  return Date.now() < (suppressIdleUntil.get(threadId) ?? 0);
}

/** Serialize handler work per chat so companion fragments cannot race. */
export async function withThreadLock(
  threadId: string,
  fn: () => Promise<void>,
): Promise<void> {
  const previous = threadLocks.get(threadId) ?? Promise.resolve();
  const run = previous.then(fn, fn);
  threadLocks.set(
    threadId,
    run.catch(() => undefined),
  );
  await run;
}
