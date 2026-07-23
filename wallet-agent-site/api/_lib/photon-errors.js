export function isUserCapacityError(message, status) {
  const text = typeof message === "string" ? message.toLowerCase() : "";

  if (status === 403 || status === 429) {
    return true;
  }

  return (
    (text.includes("max") && (text.includes("user") || text.includes("limit"))) ||
    text.includes("user limit") ||
    text.includes("maximum number") ||
    text.includes("capacity") ||
    text.includes("quota") ||
    text.includes("limit reached")
  );
}

export const WAITLIST_USER_MESSAGE = [
  "Keypass has reached its user limit for now.",
  "",
  "You're on the waitlist - we'll add you as soon as we upgrade the service.",
].join("\n");
