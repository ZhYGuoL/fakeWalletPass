# Apple Wallet Pass (`.pkpass`) — Styling & Structure Reference

Context document for agents working on PassKit bundles. Primary sources are Apple’s **Wallet Passes** documentation and the archived **Wallet Developer Guide**.

---

## Official documentation (start here)

| Topic | URL |
|--------|-----|
| Pass object overview | [Pass](https://developer.apple.com/documentation/walletpasses/pass) |
| Creating pass source (layout, `pass.json`, images, localization) | [Creating the Source for a Pass](https://developer.apple.com/documentation/walletpasses/creating-the-source-for-a-pass) |
| Signing, manifest, `.pkpass` bundle | [Building a Pass](https://developer.apple.com/documentation/walletpasses/building-a-pass) |
| Semantic tags | [Supporting semantic tags in Wallet passes](https://developer.apple.com/documentation/walletpasses/supporting-semantic-tags-in-wallet-passes) |
| Poster / enhanced event tickets (semantic tags, `preferredStyleSchemes`) | [Creating a poster event pass using semantic tags](https://developer.apple.com/documentation/walletpasses/creating-an-event-pass-using-semantic-tags) |
| Archived guide (pass styles, fields, colors, images, barcodes) | [Wallet Developer Guide: Pass Design and Creation](https://developer.apple.com/library/archive/documentation/UserExperience/Conceptual/PassKit_PG/Creating.html) |
| Field dictionary keys (detailed) | [PassKit Bundle — Field Dictionary](https://developer.apple.com/library/archive/documentation/UserExperience/Reference/PassKit_Bundle/Chapters/FieldDictionary.html) |
| HIG — Wallet | [Human Interface Guidelines — Wallet](https://developer.apple.com/design/human-interface-guidelines/wallet) |

---

## Bundle structure

- A **`.pkpass`** is a **ZIP** archive.
- **Required at top level:** `pass.json`, `manifest.json`, `signature`, and **`icon.png`** (and typically `@2x` / `@3x`).
- **`manifest.json`:** JSON object mapping **each packaged file’s relative path** → **SHA-1 hex digest** of that file’s bytes.  - **Do not** list `manifest.json` or `signature`.  
  - **Every** file in the zip (except `manifest.json` and `signature`) **must** appear in the manifest with a matching hash, and **no extra** files should be in the zip that aren’t in the manifest (Wallet validation expects consistency).
- **`signature`:** PKCS #7 **detached** signature over the **exact bytes** of `manifest.json`, **DER** encoding. Sign with the **Pass Type ID** certificate and include the **Apple WWDR** intermediate (e.g. **G4** for Pass Type ID–related certs — see [WWDR intermediate certificates](https://developer.apple.com/help/account/certificates/wwdr-intermediate-certificates)).
- **Do not** ship editor-only assets inside the zip (e.g. source `.svg`, unused `.png`), or the manifest and zip will drift and the pass may fail to add on device.

---

## Top-level `pass.json` (all passes)

Commonly required / standard keys:

- **`formatVersion`:** `1`
- **`passTypeIdentifier`:** Registered **Pass Type ID** (e.g. `pass.com.example.event`); must match the **signing certificate**.
- **`serialNumber`:** Unique per pass type; same type + serial = same pass (updates replace).
- **`teamIdentifier`:** Apple Developer **Team ID**; must match signing cert.
- **`organizationName`:** Shown in contexts like Mail / lock screen relevance.
- **`description`:** Accessibility / VoiceOver; short, distinctive summary.
- **Colors (RGB strings):** `backgroundColor`, `foregroundColor` (field **values** on front), `labelColor` (field **labels** on front). If a **background image** is used, background color may be ignored per Apple.
- **Style key:** One of `boardingPass`, `coupon`, `eventTicket`, `storeCard`, `generic` — holds nested field groups.
- **`barcodes`:** Array of barcode objects; first supported format wins. Legacy singular `barcode` may still appear for compatibility.
- **`userInfo`:** Optional dictionary for app-specific data; not rendered by Wallet by default (safe for build tooling metadata if needed).

---

## Pass styles (visual template)

From Apple’s table (abridged):

| Style | Typical use | Images (see Apple for full rules) |
|--------|-------------|-----------------------------------|
| `boardingPass` | Transit / flights | `logo`, `icon`, `footer` |
| `coupon` | Offers | `logo`, `icon`, `strip` |
| `eventTicket` | Events | `logo`, `icon`, `strip`, `background`, `thumbnail` — **strip vs background/thumbnail** mutually constrained |
| `storeCard` | Loyalty / gift | `logo`, `icon`, `strip` |
| `generic` | Everything else | `logo`, `icon`, `thumbnail` |

**Event ticket:** distinctive **top edge** (cutout) per HIG; layout differs from coupons/boarding passes.

---

## Fields (front of pass)

Field groups are **`PassFields`**: `headerFields`, `primaryFields`, `secondaryFields`, `auxiliaryFields`, plus `backFields` for the back.

### Limits (general — Apple)

- Up to **3** `headerFields`
- **1** primary field in general; **boarding pass** allows up to **2** primary
- Up to **4** secondary and **4** auxiliary (exact rules vary by style — coupons/store cards/generic with square barcode share a **combined** cap for secondary+auxiliary)
- Long text may cause fields to **hide** or truncate

### Ordering

- **Order of arrays** (`primaryFields` vs `secondaryFields`) does **not** move whole sections.
- **Order inside** each array **does** affect order of fields **within that section**.

### Formatting (Apple)

- **Alignment:** Apple’s older guide refers to an **`alignment`** key; examples also show **`textAlignment`** (e.g. `PKTextAlignmentRight`). If one doesn’t behave on a given iOS version, try the other per [Field Dictionary](https://developer.apple.com/library/archive/documentation/UserExperience/Reference/PassKit_Bundle/Chapters/FieldDictionary.html).
- **Dates/times:** Prefer ISO8601 `value` with `dateStyle` / `timeStyle` / `isRelative` so Wallet localizes correctly.
- **Numbers:** `numberStyle`, `currencyCode`, etc.

### Header fields (practical)

- Only header fields stay salient when passes are **stacked** in Wallet — use sparingly.
- **Typography:** Wallet applies **style per field tier**, not per-line mixed sizes inside one field. Achieving “small time + large date” like some third-party designs may require **compromises** (e.g. semantic poster layout on supported OS builds, or accepting uniform header styling).
- **`logoText`:** Shown next to the logo; combining with a wide `logo.png` can **overlap** visually — often omit `logoText` if the logo image already includes the wordmark.

### Tier layout (event tickets)

Conceptually: **header** (top) → **primary** (hero) → **secondary** → **auxiliary** (often two columns). Skipping a tier may still **reserve vertical space** in some layouts; adjusting which tier holds “location” / “time” changes perceived spacing.

---

## Images (from Apple’s sizing guidance)

Apple documents **allotted** regions (points); images are **scaled** and **cropped** to fit aspect ratio.

- **`icon.png`:** ~**29×29** pt (notifications, Mail, etc.); provide `@2x`, `@3x`.
- **`logo.png`:** Allotted ~**160×50** pt — “in most cases **narrower**”; displayed **top-left** near optional logo text.
- **Strip / background / thumbnail:** Event and other styles have specific rules; **event ticket:** if **`strip`** is set, **do not** also set **`background`** or **`thumbnail`** (per Apple table).
- **Localization:** `xx.lproj/` folders; images in the **root** override localized variants per Apple note.

**Agent pitfall:** Wallet often **centers** the **logo** in its header slot. Putting **right-aligned** text **inside** a wide `logo.png` can make that block appear **centered on the card** instead of flush to the screen’s right margin. For true right alignment of date/time, **header fields** with right alignment are usually more reliable than baking into `logo.png`.

---

## Barcodes

- **`barcodes`:** array; each entry: `format` (e.g. `PKBarcodeFormatQR`), `message`, `messageEncoding` (commonly `iso-8859-1`).
- **watchOS** does not support all formats (e.g. Code128) — provide fallbacks if needed.
- **Poster event ticket** documentation states **poster** style is **not** compatible with tickets that **require** QR/barcode for entry — read Apple’s constraints before mixing poster style with scan-based entry.

---

## Semantic tags & poster event tickets

- Top-level **`semantics`** (or per-field `semantics`) gives structured data for system features (suggestions, Event Guide, maps, etc.).
- **`preferredStyleSchemes`:** e.g. `posterEventTicket` + `eventTicket` for the enhanced event layout on **supported** OS versions; **legacy** `eventTicket` fields should still be populated for backward compatibility.
- Requires additional keys (`eventName`, venue fields, `eventType`, dates, etc.) per Apple’s **minimum requirements** — see the poster event article linked above.

---

## Signing & certificates (summary)

- Needs **Apple Developer Program** + **Pass Type ID** + **Pass Type ID certificate**.
- WWDR intermediate must **match** the chain for your signing cert (commonly **WWDR G4** for Pass Type ID).
- OpenSSL example pattern: `openssl smime -binary -sign -certfile wwdr.pem -signer pass.pem -inkey pass.key -in manifest.json -out signature -outform DER` (exact flags depend on OpenSSL version; PKCS#12 on OpenSSL 3 may need `-legacy`).

---

## Apple Watch (subset)

From Apple’s guide (abridged):

- **Strip**, **thumbnail** not shown on Watch.
- **Back of pass** not available on Watch.
- Header fields appear **under** logo / logo text; barcode at **bottom**; layout rules differ slightly (e.g. boarding pass auxiliary vs secondary order).

---

## Debugging checklist (from Apple + common practice)

- Valid JSON; required keys present for the style.
- `passTypeIdentifier` / `teamIdentifier` match signing identity.
- Manifest hashes match files; zip contents match manifest.
- No stray files (`.DS_Store`, source art) in the bundle.
- Pass Type certificate not expired; WWDR chain correct.
- Simulator: drag `.pkpass` to Simulator; device: Console / Xcode logs filtered by pass type or serial.

---

## Alignment, layout freedom, and “what you can design”

Apple does **not** publish a pixel grid or free-form layout engine for passes. **Layout is template-driven:** you pick a **pass style** (`eventTicket`, `generic`, …), fill **field buckets** (header / primary / secondary / auxiliary / back), set a few **global colors**, and supply **images** that Wallet **scales and crops** into fixed regions.

### Where Apple documents constraints

| What | Where |
|------|--------|
| Pass style → which images and rough front layout | [Pass Design and Creation](https://developer.apple.com/library/archive/documentation/UserExperience/Conceptual/PassKit_PG/Creating.html) (figures + tables for each style) |
| Field tiers, counts, ordering inside a tier | Same guide + style-specific articles under [WalletPasses](https://developer.apple.com/documentation/walletpasses) |
| Per-field formatting: alignment, date/number styles | Same guide (“Fields Support Formatting”); archived [Field Dictionary](https://developer.apple.com/library/archive/documentation/UserExperience/Reference/PassKit_Bundle/Chapters/FieldDictionary.html) for key names and allowed values |
| High-level UX (what belongs in Wallet, not low-level coordinates) | [HIG — Wallet](https://developer.apple.com/design/human-interface-guidelines/wallet) |
| Poster / semantic event layout (newer template, extra rules) | [Creating a poster event pass using semantic tags](https://developer.apple.com/documentation/walletpasses/creating-an-event-pass-using-semantic-tags) |

The modern **`PassFieldContent`** web page is intentionally minimal; the **archived Field Dictionary** and **Pass Design and Creation** chapters are still the practical references for keys like alignment and formatters.

### Stylistic freedom (realistic)

**You can control (mostly):**

- **Pass style** (board / coupon / event / store / generic).
- **Text** in fields: `label`, `value`; optional **date** / **number** formatters so Wallet localizes display.
- **Alignment** (within what PassKit supports): Apple documents an **`alignment`** key; many real-world passes also use **`textAlignment`** values such as `PKTextAlignmentRight` / `Left` / `Center` / `Natural` — validate against Apple’s field dictionary for the key name you standardize on.
- **Three colors** on the front: `backgroundColor`, `foregroundColor`, `labelColor` (background may be ignored if a background image wins).
- **Images** (`icon`, `logo`, `strip`, `background`, `thumbnail`, `footer` — **not all** apply to every style; some combinations are **mutually exclusive**, e.g. event ticket **strip** vs **background**/**thumbnail** per Apple’s table).
- **Barcode(s)** format and payload; optional **`logoText`** next to the logo (easy to clash visually with a wide `logo` image).
- **Back fields**: many fields, longer copy; data detectors for links/phones.
- **Semantic tags** / **`preferredStyleSchemes`** (e.g. poster event): richer **system-driven** presentation on supported OS versions, with **extra validation rules** (and Apple notes poster tickets aren’t compatible with passes that **require** a scannable barcode for entry).

**You generally cannot control (in `pass.json`):**

- Arbitrary **x/y** placement, layers, or z-order beyond the template.
- **Custom fonts**, per-line font sizes, or mixed weights inside a single field the way a design tool would.
- Exact **spacing** between sections (system layout); skipping a field tier may still leave **visual gap**.
- **Guaranteed** WYSIWYG parity across **iPhone / Watch / OS versions** (Watch omits strip/thumbnail and has no back; layout rules differ).

So a “designer” is really a **structured form**: choose style → assign fields to tiers → pick colors and assets → optional semantics. Anything that promises drag-and-drop free layout is **not** reflecting PassKit unless it only outputs **baked images** inside Apple’s image slots (still subject to scaling/crop).

### Building a local editor that only allows valid passes

**1. Schema validation**

- Use or adapt a **JSON Schema** for `pass.json` (community projects around PassKit often ship one; Apple does not always ship a single official schema file). Validate types, required keys, and **style-specific** branches.

**2. Structural rules (encode Apple’s tables)**

- Enforce **max counts** for `headerFields`, `primaryFields`, etc., per style.
- Enforce **image presence** and **exclusions** (e.g. event ticket: strip vs background/thumbnail).
- Enforce **barcode** compatibility (e.g. poster + required QR entry conflict per Apple).

**3. Bundle rules**

- After export: **manifest** = SHA-1 of every file in the zip except `manifest`/`signature`; zip lists **exactly** those files; no junk paths.

**4. “Possible on device” vs “valid JSON”**

- **Valid JSON + signature** still may look wrong (alignment quirks, header field order, logo centering). The only definitive **visual** check is **Simulator/device** or Apple’s documented behavior. Your editor can flag “**unverified layout**” for patterns known to be finicky (e.g. newline in `value`, `logoText` + full wordmark in `logo.png`).

**5. Optional hard gate**

- Shell out to **`signpass`** / your signer and **open in Simulator** in a CI step for a smoke test.

---

## Document history

- Compiled for local **Wallet Pass** / PassKit tooling from Apple’s public Wallet Passes documentation and PassKit Programming Guide (archived), plus practical lessons from building event-ticket-style passes (manifest/zip parity, logo vs header alignment, field tiers).

When in doubt, prefer the **current** Apple Developer Documentation URLs in the table at the top over this summary.
