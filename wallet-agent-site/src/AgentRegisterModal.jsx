import { useEffect, useId, useRef, useState } from "react";
import { formatPhoneDisplay, normalizePhoneInput, smsDeepLink } from "./lib/phone";

const OPENING_MESSAGE =
  "Hey! Send me a public Luma link and I'll build your Apple Wallet pass.";

export function AgentRegisterModal({ open, onClose }) {
  const titleId = useId();
  const descId = useId();
  const inputRef = useRef(null);
  const [phoneInput, setPhoneInput] = useState("");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);

    const timer = window.setTimeout(() => inputRef.current?.focus(), 0);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
      window.clearTimeout(timer);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      setPhoneInput("");
      setStatus("idle");
      setError("");
      setResult(null);
    }
  }, [open]);

  if (!open) return null;

  async function handleSubmit(event) {
    event.preventDefault();
    const phoneNumber = normalizePhoneInput(phoneInput);
    if (!phoneNumber) {
      setError("Enter a valid mobile number, including area code.");
      return;
    }

    setStatus("loading");
    setError("");

    try {
      const res = await fetch("/api/register-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Registration failed. Try again.");
      }
      setResult(data);
      setStatus("success");
    } catch (err) {
      setStatus("idle");
      setError(err instanceof Error ? err.message : "Registration failed. Try again.");
    }
  }

  function openMessages() {
    if (!result?.assignedPhoneNumber) return;
    const url = result.messagesUrl || smsDeepLink(result.assignedPhoneNumber, OPENING_MESSAGE);
    window.location.href = url;
  }

  async function copyNumber() {
    if (!result?.assignedPhoneNumber) return;
    try {
      await navigator.clipboard.writeText(result.assignedPhoneNumber);
    } catch {
      // Clipboard may be blocked; user can still tap Open Messages.
    }
  }

  const assignedDisplay = result?.assignedPhoneNumber
    ? formatPhoneDisplay(result.assignedPhoneNumber)
    : null;

  return (
    <div className="agent-modal" role="presentation" onClick={onClose}>
      <div
        className="agent-modal__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className="agent-modal__close" onClick={onClose} aria-label="Close">
          ×
        </button>

        {status === "success" && result ? (
          <div className="agent-modal__success">
            <p className="kicker kicker--honey">You're in</p>
            <h2 id={titleId} className="agent-modal__title">
              Text this line in iMessage
            </h2>
            <p id={descId} className="agent-modal__lede">
              Keypass assigned you a dedicated agent number. Save it, then send any public Luma
              link to get your pass.
            </p>

            <p className="agent-modal__number" aria-live="polite">
              {assignedDisplay}
            </p>

            <div className="agent-modal__actions">
              <button type="button" className="cta__button" onClick={openMessages}>
                <span className="cta__button-label">Open Messages</span>
                <span className="cta__button-icon" aria-hidden="true">
                  ↗
                </span>
              </button>
              <button type="button" className="agent-modal__secondary" onClick={copyNumber}>
                Copy number
              </button>
            </div>
          </div>
        ) : (
          <form className="agent-modal__form" onSubmit={handleSubmit}>
            <p className="kicker kicker--honey">Get started</p>
            <h2 id={titleId} className="agent-modal__title">
              Add the agent to your phone
            </h2>
            <p id={descId} className="agent-modal__lede">
              Enter the mobile number where you use iMessage. Photon assigns you a line to text —
              no app download required.
            </p>

            <label className="agent-modal__field">
              <span className="agent-modal__label">Your phone number</span>
              <input
                ref={inputRef}
                type="tel"
                name="phone"
                autoComplete="tel"
                inputMode="tel"
                placeholder="+1 (415) 555-0199"
                value={phoneInput}
                disabled={status === "loading"}
                onChange={(event) => {
                  setPhoneInput(event.target.value);
                  if (error) setError("");
                }}
              />
            </label>

            {error ? (
              <p className="agent-modal__error" role="alert">
                {error}
              </p>
            ) : null}

            <div className="agent-modal__actions">
              <button type="submit" className="cta__button" disabled={status === "loading"}>
                <span className="cta__button-label">
                  {status === "loading" ? "Registering…" : "Get agent number"}
                </span>
                <span className="cta__button-icon" aria-hidden="true">
                  ↗
                </span>
              </button>
              <button type="button" className="agent-modal__secondary" onClick={onClose}>
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
