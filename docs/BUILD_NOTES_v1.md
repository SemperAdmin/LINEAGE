# LINEAGE v1.1.0-rc1, Build Notes and Verification Record

Build date: 24 August 2026
Deliverable: lineage.html, one file, 101 KB, no build step, no dependencies
Verification: 155 automated checks, 155 passed, 0 failed
Test harness: headless Chromium, page loaded from a file:// path

---

## 0a. Semper Admin Portal styling, added in v1.1.0

The interface now runs the Semper Admin Portal token set v1.2 with every correction from the style guide audit applied inline. Both themes ship, dark is the default per Semper design principle 1, and the toggle lives in the topbar. Theme state is a JavaScript variable and dies with the tab, because constraint 3 forbids storage.

### Corrections carried in, not the v1.2 values

| Token | v1.2 value | This build | Why |
| --- | --- | --- | --- |
| `--color-primary` dark | `#D14150` | `#C93A48` surface plus `#D9616D` text | One token could not clear 4.5:1 as both a button surface and link text. Split |
| `--color-primary-foreground` dark | `#060E1A` | `#FFFCF4` | 4.22:1 became 4.90:1 |
| `--color-ring` dark | `#B82230` | `#CD2635` | 2.54:1 on a card against a required 3:1 for a focus indicator |
| `--color-subtle-foreground` | `#8A7E63` light, `#8A7F66` dark | `#726852`, `#92876C` | Mono citations sat at 3.64:1 and 4.08:1 |
| `--color-destructive` dark | `#B83232` | `#D56565` | 2.72:1 on a card |
| `--color-status-stale` dark | `#B83232` | `#D56565` | 3.11:1 on the least visible status in the default theme |
| `--color-status-info` dark | `#2F5FA8` | `#5988D1` | 2.92:1 |
| `--color-status-fresh` | `#2F8F5C` | `#27774D` light, `#329962` dark | 3.67:1 and 4.00:1 |
| `--color-status-aging` light | `#C97D1F` | `#955C17` | 2.97:1 |
| `--color-accent` as text | `#B89042` | `#81652E` in light, separate text token | Brass as text reached 2.69:1 |
| `--shadow-card`, `--shadow-card-strong` | never overridden for dark | aliased to `--shadow-sm` and `--shadow-md` | Cards kept parchment-computed shadows in the default dark theme |
| `:focus-visible` | set `border-radius: 2px` | omitted | Snapped a 9999px chip and an 8px card to 2px on focus |
| Ambient bloom transition | 300ms | 240ms | Exceeded the guide's own stated ceiling |
| Spacing ladder | 4/8/12/16/24/32/48/64 with the table using 18, 20, 40, 56 | 4/8/12/16/20/24/32/40/48/56/64 | The ladder now matches what the system actually does |

### Forced deviations from the Semper guide

- No Bebas Neue. Section 11 of the guide requires three npm font packages and three import statements. LINEAGE constraint 1 forbids a build step and a font import, constraint 2 forbids any remote reference. Display type falls to a system condensed stack, Bahnschrift on Windows and DIN Alternate on macOS, with uppercase and wide tracking carrying the display character.
- No Inter and no JetBrains Mono for the same reason. The body and mono stacks are system-native.
- No Tailwind. The tokens are inline CSS custom properties.

Everything else from the guide ports intact: the floating pill topbar with backdrop blur, the ambient bloom in dark mode, the gradient accent restricted to a single hero word, the stat tile spec with a 32px icon and a 44px display numeral, 24px card padding with 18px grid gaps, and the complete reduced-motion gate.

### Stat tiles map to the tool's semantics

Four tiles render above the file card: provenance findings, explicit AI signals, capability limits, and detected format. The AI signal tile uses the brass accent rather than a red, because handoff section 9 requires AI signals to render distinctly and never with an alarming color. The capability limit tile uses the aging amber, because an unread structure is an open question rather than a failure.

---

## 0. Automatic derivation, added in rc2

The label module no longer asks for values the document already states. It fills them, names the source of each one, and leaves empty every field describing human conduct.

The dividing line is not convenience. A value the tool fills is a value the document asserts about itself. A value the tool leaves empty is a claim about what a person did, and a tool prefilling one of those manufactures the assertion the annotation exists to make.

### Filled from the file

| Field | Source, in priority order | Fallback |
| --- | --- | --- |
| Document title | dc:title, PDF /Title, XMP dc:title, EXIF XPTitle | File name, flagged as operator supplied and untrusted |
| Document date | dcterms:modified, PDF /ModDate, then the creation equivalents, then EXIF DateTime, then PNG tIME | File system modification time, flagged as changing on copy |
| Review date | none, this is a tool default of today, and the note and the attestation both say so | none |
| GenAI tool | A claim generator or a custom document property naming a generative tool, filled only when an explicit trained-algorithmic source type appears in the same file | Left empty, with software names from the file offered as suggestions in a picker |

The GenAI tool rule deserves its own line. A software field records what wrote the file, not what generated its content. Prefilling the tool name from a Software or Producer string would put an unfounded assertion into a signed record, so the build offers those strings as suggestions and fills the field only when the file itself declares a generator alongside a generative source type.

### Never filled

| Field | Reason |
| --- | --- |
| Contribution scope | A judgment about your own work. Section 0.3 forbids this tool from deciding whether a passage was written by AI, and an auto-set scope is exactly that decision |
| Portion affected | No metadata field records which passages a tool touched |
| Human reviewer | An author or last-modified-by field names who edited the file, not who reviewed the output. Names found in the file are offered as suggestions only |
| Operator | Self-asserted by definition, and recorded as such |
| Accuracy confirmation | A human act. The build will not pre-check it |

Scope, portion, and the confirmation reset on every new file, because all three describe one specific document.

### Auditability of the derivation

Every filled field carries a visible source note. Editing a filled field flips that note to operator entered and updates the summary count. The attestation gains an ANNOTATION FIELD PROVENANCE block recording, per field, whether the value was read from the file and from which part, defaulted by the tool, derived from the file name or file system, overridden by the operator, or entered by the operator because the tool has no basis for it.

A reader of the filed attestation therefore knows which parts of the annotation the document vouches for and which parts rest on the signature alone.

---

## 1. Deviations from the handoff

Every deviation below traces to a defect in the audit. Nothing was changed for convenience.

| Handoff text | Build behavior | Audit reference |
| --- | --- | --- |
| Section 6.2, C2PA box type at APP11 payload offset 4 | Reads TBox at payload offset 12, after JP, box instance, and packet sequence | C-1 |
| Section 6.2, silent on multi-segment manifests | Groups APP11 segments by box instance, orders by packet sequence, reassembles, takes length from LBox, reports a truncation limit on a short assembly | C-2 |
| Section 6.7, C2PA manifest sets aiSignal true | Manifest presence is a provenance finding. aiSignal is set only by a trained-algorithmic IPTC DigitalSourceType | C-3 |
| Section 6.5, no encryption case | Detects /Encrypt before resolving /Info, emits a limit, reports zero authorship findings rather than ciphertext | C-4 |
| Section 6.2, every marker carries a length | Skips fill bytes, treats SOI, EOI, TEM, and RST0 through RST7 as zero-length, guards length below 2 | H-1 |
| Section 6.3, reuse the IFD0 parser from 6.2 | TIFF reader takes an explicit start offset. JPEG APP1 passes 6, PNG eXIf passes 0 | H-2 |
| Section 6.4, entry offsets from the central directory | Seeks the local file header, validates its signature, reads its own name and extra lengths | H-3 |
| Section 6.3, report zTXt as unreadable-compressed | Inflates zTXt and compressed iTXt with DecompressionStream in deflate mode. The limit fires only on real failure | H-4 |
| Section 6.3, iTXt as a keyword and value pair | Walks the full layout, keyword, compression flag, compression method, language tag, translated keyword, text | M-1 |
| Section 6.7, never normalize a value | PDF strings report the decoded value plus the encoding and the raw bytes. Both are preserved | M-4 |
| Section 8.2, crypto.subtle only | crypto.subtle first, hand-written in-page SHA-256 as fallback. The attestation names which one produced the digest | M-5 |
| Section 10.15, no memory strategy | Byte-level search throughout, no full-buffer string materialization, text scanning capped at 4 MB with a limit recorded | M-6 |
| Section 7.2, line 7 says undersigned | Line 8 names the reviewing official at line 6, and the block ends with a signature and date line | M-7 |
| Section 7.1, no document date | Document date added, required | M-8 |
| Section 8.3, local ISO 8601 | Timestamp carries an explicit UTC offset with the Zulu equivalent alongside | M-9 |
| Section 5, parseTextual undefined | Detects and reports zero-width and bidirectional control characters with codepoint and count. Detection only, nothing is removed | G-1 |
| Section 6.1, five formats | TIFF, WebP, HEIC, AVIF, MP4, MOV, GIF, and BMP are detected and reported as format-unsupported-in-v1 rather than falling through to text | G-2 |
| Section 6.4, Word paths only | Adds xl/workbook.xml and ppt/presentation.xml. External relationships key on TargetMode as well as scheme | G-3 |
| Section 6, no malformed input handling | Bounds guard on every offset read, iteration cap on every walk, parser abort recorded as a limit | G-4 |
| Section 10.5, hash before and after on disk | Re-hashes the in-memory buffer after parsing and compares to the load digest. A mismatch renders as READ-ONLY VIOLATION | A-1 |
| Section 8.4, clipboard only | Clipboard first, selectable textarea second, print stylesheet third. No download, no file write | P-4 |
| Section 8.3 disclaimer | Adds the unread-is-not-absent line and the operator self-assertion line | P-5 |

Two additions carry no handoff line at all.

- A LINEAGE self-check finding appears in every inspection, stating the input buffer digest was unchanged across the parse. The read-only claim is now visible to the operator rather than asserted in documentation alone.
- The footer states the live environment: whether inflation is available, whether crypto.subtle is available, and whether the page is running from a local path. An operator on a hardened baseline sees the degraded capability before trusting a result.

---

## 2. Verification record

### Constraint gates

| Gate | Result |
| --- | --- |
| Static scan, no network API by word boundary regular expression | 0 occurrences across 5 patterns |
| Static scan, no storage API | 0 occurrences across 5 patterns |
| Static scan, no remote resource load syntax | 0 occurrences across 5 patterns |
| Static scan, no external file reference and no source map | pass |
| Full inspection cycle from a file:// path | pass on all 16 fixtures |
| Non-local network requests observed across every inspection | 0 |
| localStorage, sessionStorage, cookies, IndexedDB after a full cycle | all empty |
| Input buffer digest before and after parsing | identical on every fixture |
| Uncaught page errors across the whole suite | 0 |

### Functional gates

| Fixture | Checks | Result |
| --- | --- | --- |
| JPEG, EXIF, XMP, COM, restart markers, fill bytes, no C2PA | 11 | pass, zero AI signals |
| JPEG, multi-segment C2PA declaring generative source | 6 | pass, one AI signal, reassembly confirmed |
| JPEG, camera-signed C2PA, no generative source | 3 | pass, zero AI signals, no false attribution |
| PNG, tEXt keyword and value pairs | 4 | pass, values verbatim |
| PNG, eXIf and caBX | 5 | pass, eXIf read at chunk offset 0 |
| PNG, compressed zTXt and iTXt | 3 | pass, both inflated |
| docx, author, tracked changes, comments, rsid, custom property, external link | 12 | pass |
| docx, C2PA part | 3 | pass, one AI signal |
| PDF, plain /Info with octal escapes and a UTF-16BE hex string | 7 | pass, both decodings correct |
| PDF, compressed cross-reference stream | 4 | pass, reported unreadable, not absent |
| PDF, encrypted | 3 | pass, no ciphertext presented as an author field |
| PNG named report.pdf | 3 | pass, detection follows magic bytes |
| Zero-byte file | 4 | pass, correct empty-input digest, no clean claim |
| 200 MB file | 3 | pass, 6.2 seconds, no crash |
| Plain text with four invisible character classes | 4 | pass |
| Plain text, clean | 1 | pass |
| Label module, scope none and scope populated | 8 | pass, suppression explained to the operator |
| Attestation | 7 | pass, disclaimer intact, digest correct |
| Derivation, docx with no AI signal | 16 | pass, title and date filled with sources named, tool left empty |
| Derivation, docx declaring a generator with an AI signal | 3 | pass, tool filled, scope still not auto-set |
| Derivation, override tracking and field provenance | 11 | pass, override recorded in the attestation |
| Derivation, fallbacks when the file declares nothing | 4 | pass, both fallbacks flagged as untrusted |

Total: 155 checks, 155 passed.

### What the tests do not cover

Stated plainly, because an unstated gap becomes an assumed capability.

- Real-world C2PA files from production tooling. Every C2PA fixture is hand-built to the byte layout. The offsets are correct against the specification, and confirmation against a file from a signing camera and from a commercial generator is still owed.
- Signature validation. Out of scope by design, and the tool says so in every attestation.
- Browsers other than Chromium. Firefox and Edge behavior on file:// clipboard access needs a check on the target workstation baseline.
- ZIP64 packages and OOXML files above 4 GB.
- Encrypted PDF detection uses a token scan. A PDF containing the literal /Encrypt inside a content stream would produce a conservative false limit rather than a false finding, which is the safe direction.

---

## 3. Fielding checklist

1. Confirm the workstation baseline browser supports DecompressionStream. The footer reports it at load. Without it, compressed Office parts and PNG text chunks report as unreadable rather than absent, which is correct but degraded.
2. Test clipboard delivery on the actual VDI or thin client in use. The textarea and print paths cover failure, and an operator who never sees the failure will not know to use them.
3. Route the four sponsor decisions in the audit disposition before fielding: M-4 encoding presentation, P-4 print path approval, G-1 textual scope, G-2 unsupported format boundary.
4. Cite MARADMIN 635/24 rather than 602/24 wherever COMMSTRAT annotation requirements appear.

---

## 4. Files

- lineage.html, the deliverable, single file, opens from a local path with no server.
- lineage_test_kit.zip, the fixture generator, the 16 test fixtures, and the 121-check harness. Run with node after installing playwright. The kit exists so the acceptance gates are re-runnable by whoever maintains this next, rather than trusted from a report.
