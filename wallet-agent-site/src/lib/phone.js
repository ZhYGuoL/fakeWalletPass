const E164 = /^\+[1-9]\d{6,14}$/;

/** Strip to digits and leading + for normalization. */
export function digitsOnly(value) {
  return String(value ?? "").replace(/[^\d+]/g, "");
}

/**
 * Best-effort US/international normalization to E.164.
 * Returns null when the result would not satisfy Photon's pattern.
 */
export function normalizePhoneInput(raw, defaultCountryCode = "1") {
  let value = digitsOnly(raw);
  if (!value) return null;

  if (value.startsWith("+")) {
    value = `+${value.slice(1).replace(/\D/g, "")}`;
  } else {
    const digits = value.replace(/\D/g, "");
    if (digits.length === 10 && defaultCountryCode === "1") {
      value = `+1${digits}`;
    } else if (digits.length === 11 && digits.startsWith("1")) {
      value = `+${digits}`;
    } else {
      value = `+${defaultCountryCode}${digits}`;
    }
  }

  return E164.test(value) ? value : null;
}

export function formatPhoneDisplay(e164) {
  if (!E164.test(e164)) return e164;
  if (e164.startsWith("+1") && e164.length === 12) {
    const area = e164.slice(2, 5);
    const mid = e164.slice(5, 8);
    const last = e164.slice(8);
    return `+1 (${area}) ${mid}-${last}`;
  }
  return e164;
}

export function smsDeepLink(assignedPhoneNumber, message = "") {
  const body = message ? `&body=${encodeURIComponent(message)}` : "";
  return `sms:${assignedPhoneNumber}${body}`;
}
