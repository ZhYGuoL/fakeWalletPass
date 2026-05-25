import type { ExtractResult } from "./types.js";

export type PassDraft = {
  sourceUrl: string;
  extracted: ExtractResult["extracted"];
  ticketTypes: string[];
  guestName?: string;
  selectedTicketType?: string;
};

export type AwaitingField = "address" | "ticketType" | "guestName";

export type Session =
  | { kind: "idle" }
  | {
      kind: "collecting";
      draft: PassDraft;
      awaiting: AwaitingField;
      ticketOptions?: string[];
    };

const sessions = new Map<string, Session>();

export function getSession(threadId: string): Session {
  return sessions.get(threadId) ?? { kind: "idle" };
}

export function setSession(threadId: string, session: Session): void {
  if (session.kind === "idle") {
    sessions.delete(threadId);
    return;
  }
  sessions.set(threadId, session);
}

export function resetSession(threadId: string): void {
  sessions.delete(threadId);
}

export function nextAwaiting(
  draft: PassDraft,
  result?: Pick<ExtractResult, "missingFields" | "hiddenFields">,
): { field: AwaitingField; ticketOptions?: string[] } | null {
  const missing = new Set(result?.missingFields ?? []);
  const hidden = new Set(result?.hiddenFields ?? []);
  const ticketTypes = draft.ticketTypes;

  if ((missing.has("address") || hidden.has("address")) && !draft.extracted.address) {
    return { field: "address" };
  }
  if (ticketTypes.length > 1 && !draft.selectedTicketType) {
    return { field: "ticketType", ticketOptions: ticketTypes };
  }
  if (!draft.guestName) {
    return { field: "guestName" };
  }
  return null;
}

export function startDraft(
  threadId: string,
  sourceUrl: string,
  result: ExtractResult,
): Session {
  const draft: PassDraft = {
    sourceUrl,
    extracted: { ...result.extracted },
    ticketTypes: [...result.ticketTypes],
  };
  const next = nextAwaiting(draft, result);
  const session: Session = next
    ? {
        kind: "collecting",
        draft,
        awaiting: next.field,
        ticketOptions: next.ticketOptions,
      }
    : { kind: "idle" };
  setSession(threadId, session);
  return session;
}

export function applyAnswer(
  session: Session,
  text: string,
): { session: Session; invalid?: boolean } {
  if (session.kind !== "collecting") {
    return { session };
  }

  if (nextAwaiting(session.draft) === null) {
    return { session };
  }

  const draft: PassDraft = {
    ...session.draft,
    extracted: { ...session.draft.extracted },
  };

  switch (session.awaiting) {
    case "address":
      draft.extracted.address = text.trim();
      break;
    case "ticketType": {
      const pick = text.trim();
      const options = session.ticketOptions ?? draft.ticketTypes;
      const match =
        options.find((option) => option.toLowerCase() === pick.toLowerCase()) ??
        options[Number(pick) - 1];
      if (!match) {
        return { session, invalid: true };
      }
      draft.selectedTicketType = match;
      break;
    }
    case "guestName":
      draft.guestName = text.trim();
      break;
  }

  const next = nextAwaiting(draft);
  if (!next) {
    return { session: { kind: "collecting", draft, awaiting: session.awaiting } };
  }

  return {
    session: {
      kind: "collecting",
      draft,
      awaiting: next.field,
      ticketOptions: next.ticketOptions,
    },
  };
}

export function isComplete(session: Session): boolean {
  if (session.kind !== "collecting") return false;
  return nextAwaiting(session.draft) === null;
}

export function promptFor(session: Session): string {
  if (session.kind !== "collecting") {
    return "";
  }

  switch (session.awaiting) {
    case "address":
      return session.draft.extracted.address
        ? ""
        : "What address should go on the pass? (The Luma page didn't show it publicly.)";
    case "ticketType": {
      const options = session.ticketOptions ?? session.draft.ticketTypes;
      const lines = options.map((name, i) => `${i + 1}. ${name}`).join("\n");
      return `Which ticket type?\n${lines}\n\nReply with the number or name!`;
    }
    case "guestName":
      return "What name should go under GUEST on the pass?";
    default:
      return "";
  }
}
