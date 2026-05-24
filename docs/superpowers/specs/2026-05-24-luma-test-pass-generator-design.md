# Luma Test Pass Generator Design (Local Prototype)

## Goal

Build a local web prototype that:
- accepts a public Luma event URL,
- extracts publicly visible event details,
- prompts the user for hidden or missing details,
- generates a downloadable, signed `.pkpass`,
- enforces test-only behavior and clear anti-misuse markers.

This design is explicitly for a non-valid testing simulator.

## Scope and Constraints

- Runtime target: local-only first.
- Extraction scope: public Luma page content only (no login/session simulation).
- Missing data behavior: always prompt user for anything hidden or missing.
- Ticket type behavior: if multiple ticket types exist, force explicit user selection.
- Safety behavior: always include visible `TEST / NOT VALID` marker.
- QR behavior: always use a dummy link payload.

## Architecture

Extend the existing `wallet-web` app and reuse existing pass packaging/signing scripts.

### Frontend (`wallet-web`)

- Single-page guided flow:
  1. Enter Luma URL and extract.
  2. Review and edit extracted fields.
  3. Resolve missing/hidden values via prompts.
  4. Verify signing readiness and generate pass.
- Show extraction confidence/source hints where possible.
- Require explicit ticket type selection when multiple types are detected.
- Provide direct `.pkpass` download on success.

### Backend API (`wallet-web/api`)

- `POST /api/extract-luma`
  - Input: Luma URL.
  - Fetch and parse publicly visible page content.
  - Return extracted fields, missing fields, hidden-field explanations, and candidate ticket types.

- `POST /api/generate-pass`
  - Input: user-confirmed final payload.
  - Revalidate required fields and constraints.
  - Enforce test-only overrides.
  - Build/sign bundle and return downloadable `.pkpass`.

### Pass Build/Signing Layer

- Reuse current local scripts for:
  - pass JSON assembly,
  - asset generation/selection,
  - manifest/signature creation,
  - `.pkpass` packaging.
- Add a small adapter to map web payload to the script inputs.

## Data Model

Canonical internal model for the flow:

- `eventTitle` (required)
- `locationName` (optional, prompt if missing)
- `address` (optional if hidden; prompt if missing)
- `guestName` (required user entry for personalization)
- `hostName` (optional, used when ticket-type substitution does not apply)
- `ticketTypes[]` (optional; if >1 then user must choose)
- `selectedTicketType` (required when `ticketTypes.length > 1`)
- `startDateTime` (required)
- `endDateTime` (optional)
- `timezone` (best effort; fallback user/system)
- `eventImageUrl` and downloaded image asset (required with fallback policy)
- `missingFields[]` (derived)
- `hiddenFields[]` (derived with explanations)

## Wallet Mapping Rules

- Pass style: event ticket-compatible layout.
- Event image: use Luma image as pass image asset (within PassKit constraints).
- Background color: computed from average color of the event image.
- Host/ticket slot rule:
  - If multiple/selectable ticket types exist, show selected ticket type in that slot.
  - Otherwise show host in that slot.
- Barcode/QR payload: always dummy URL.
- Safety text: always visible `TEST / NOT VALID`.

## Flow Details

1. User enters URL.
2. `extract-luma` returns best-effort extraction result.
3. UI renders editable extracted values.
4. UI highlights hidden/missing fields with explanation.
5. User resolves each missing field:
   - provide explicit value, or
   - choose placeholder (per field choice behavior).
6. User selects ticket type when required.
7. User clicks generate.
8. `generate-pass` validates and enforces safety overrides.
9. Backend signs and returns `.pkpass`.

## Validation Gates

### Extraction and Input

- URL must match supported Luma event format.
- If extraction fails completely, allow manual entry fallback with clear notice.
- Hidden/missing fields are non-fatal if user resolves via value or placeholder.

### Required Data

Block generation only when required pass data is unresolved:
- `eventTitle`
- `startDateTime`
- `guestName`
- ticket type when required by detected options

### Test-Only Enforcement (Non-Optional)

On every generation:
- enforce visible `TEST / NOT VALID`,
- enforce dummy QR payload,
- ignore any client attempt to override these safeguards.

### Signing Readiness

Expose preflight status in UI:
- signing cert/key presence,
- pass type and team identifiers,
- WWDR/intermediate availability,
- probe signing result.

## Error Handling

- Scrape/network error:
  - Show retry option and manual entry path.
- Hidden address or hidden details:
  - Explain public-page limitation and ask user input.
- Image fetch failure:
  - fallback to default test image.
- Signing failure:
  - show precise diagnostic (identifier mismatch, chain issue, expiry, script error).
- Packaging failure:
  - show exact failing step (manifest/signature/zip).

## Download Reliability Strategy

- Generate each pass in isolated temp work directory.
- Build `manifest.json` from actual included files.
- Sign manifest with local signing assets.
- Package `.pkpass` and return as file response.
- Save optional debug artifact copy in local output folder.
- Filename format: `test-<event-slug>-<timestamp>.pkpass`.

## UI Structure

### Step 1: Extract
- URL input + extract action.
- Public-content-only note.

### Step 2: Review
- Editable extracted fields.
- Image preview.
- Missing/hidden field warnings.

### Step 3: Resolve
- Required ticket-type chooser if multiple types.
- Per-field choice for missing data (provide value vs placeholder).

### Step 4: Generate
- Signing readiness panel.
- Generate button.
- Success state with direct download link.

## Test Plan (Implementation Phase)

- Extraction variants:
  - full detail page,
  - hidden address page,
  - multi-ticket page,
  - sparse metadata page.
- Rule tests:
  - host vs ticket-type substitution.
- Safety tests:
  - always `TEST / NOT VALID`,
  - always dummy QR payload.
- Color tests:
  - average color extraction produces valid RGB.
- Signing tests:
  - successful local sign,
  - expected failures with actionable diagnostics.
- Output tests:
  - pass bundle structure validity,
  - successful `.pkpass` download.

## Out of Scope (for this prototype phase)

- iMessage agent integration.
- Deployed/public environment setup.
- Non-Luma sources.
- Any login-gated scraping behavior.
