# LINEAGE

Document provenance inspection. One HTML file. No server, no build step, no network, no stored state.

LINEAGE opens a file in your browser, parses the metadata the file already carries, and reports every provenance signal it finds. It then helps you produce the generative AI use annotation required by NAVMC 5239.1 paragraph 4.b.(5), and issues a hash-anchored attestation record.

It reads. It never writes to your file, never uploads it, and never stores anything.

## Why this exists

NAVMC 5239.1 puts the labelling duty on the person, not on a tool. Paragraph 4.b.(5) requires a label on any document created, in whole or in part, with output from a generative AI tool, and paragraph 4.b.(4) puts responsibility for the product on whoever used one.

Labelling a document honestly means knowing what it already declares about its own origin. That data sits in structures no ordinary application surfaces: EXIF and XMP in images, C2PA content credentials, Office document properties, tracked changes and comment authors, PDF information dictionaries, and invisible characters inside plain text. Word does not show it. Acrobat does not show it. A photo viewer does not show it.

The usual way to see it is to upload the document to an online metadata reader, which is the wrong trade for anything heading to a record folder.

LINEAGE reads the file in the browser, on the machine, with no network. Then it stops short of the line a tool should not cross.

**It will not decide whether AI wrote a passage.** No metadata field records that. A tool inferring it would manufacture the very assertion the annotation exists to make. Contribution scope, portion affected, reviewer, and the accuracy confirmation stay with the operator, and the attestation records that they came from a person rather than from the file.

**It will not report a quiet result as a clean one.** Zero findings with zero limits means clean. Zero findings with limits recorded means unknown. Everything the parse was unable to read is listed by name, because unread is not the same as absent.

**It will not vouch for a content credential.** A C2PA manifest is reported as present and never validated, and the attestation says so.

## Current build

| Field | Value |
| --- | --- |
| Version | `1.1.0-rc3` |
| File | `index.html` |
| Size | 119,426 bytes |
| SHA-256 | `5D5A25BE0AE955C268461215031355FAF146F24D87DF335D615FB87A4BA1AD39` |
| Acceptance suite | 155 checks, 155 passed |

Verify what you downloaded before you trust it:

```
sha256sum index.html                      # Linux, macOS
Get-FileHash index.html -Algorithm SHA256 # Windows PowerShell
```

A digest that does not match the table means the file is not this build. Do not use it for a record.

## Use

Download `index.html` and open it. That is the whole installation. It runs from a `file://` path with no server and no internet connection.

Three modules on one page:

1. **Inspect.** Format detected by magic bytes, never by file extension. Hand-written parsers for JPEG, PNG, Office Open XML, PDF, and plain text. Findings are grouped by category, and every capability limit hit during the parse is reported separately.
2. **Label.** Fills what the document declares about itself, names the source of each filled value, and leaves empty every field describing human conduct.
3. **Attest.** SHA-256 over the input, the findings, the limits, the annotation, the field provenance, and a mandatory disclaimer. Delivered to the clipboard or to print. No file is written.

## Hosted copy

The tool is served at **https://semperadmin.github.io/LINEAGE/** for trying it without downloading anything. The page still makes no network request of its own once loaded, and still stores nothing.

For anything going into a record, use a downloaded copy whose digest you have checked. The hosted page arrives over the network, so what you ran is whatever the host served at that moment. A local file whose SHA-256 you verified against the table above is the defensible artifact, and the attestation is only as good as the provenance of the tool that produced it.

## Two rules the tool will not bend

**Absence of findings is never reported as a clean result.** Zero findings with zero limits means clean. Zero findings with a populated limits list means unknown. The interface renders those differently and the attestation says which one you got. Anything LINEAGE could not read is listed by name, because unread is not the same as absent.

**LINEAGE asserts nothing about AI involvement on its own.** Contribution scope, portion affected, reviewer, and the accuracy confirmation stay empty. Those are claims about what a person did. A tool that prefills them manufactures the assertion the annotation exists to make.

A consequence worth stating: a C2PA content credential is a provenance signal, not an AI signal. Leica, Nikon, Sony, and Canon sign ordinary captures with C2PA. Only an IPTC `DigitalSourceType` resolving to `trainedAlgorithmicMedia` or `compositeWithTrainedAlgorithmicMedia` sets an AI flag.

## Constraints

These are acceptance gates. A build failing any one is rejected, and the suite checks all of them.

1. One file. No build step, no bundler, no external stylesheet, no font import, no source map. Embedded `data:` URIs are permitted because they travel inside the file rather than being fetched.
2. Zero network. No fetch, XMLHttpRequest, WebSocket, sendBeacon, dynamic import, or remote script, style, or image.
3. Zero storage. No localStorage, sessionStorage, IndexedDB, cookies, Cache API, File System Access write, or anchor download.
4. Read-only on input. The buffer is re-hashed after parsing and compared to the digest taken at load. A mismatch renders as a read-only violation.
5. No generative model. Deterministic byte parsing only.
6. No third-party code. Every parser is hand-written. The only platform APIs used are FileReader, DecompressionStream, `crypto.subtle`, and the clipboard.
7. Offline first. The page runs from a `file://` path.

## Verify it yourself

The acceptance suite is in `test-kit/`. It exists so the gates are re-runnable rather than trusted from a report.

```
cd test-kit
npm install playwright
python3 make_fixtures.py
python3 -c "open('fixtures/17_large_200mb.bin','wb').write(b'A'*1024*1024*200)"
node test_lineage.js
```

Paths resolve from the script location, so a clone runs as-is. `CHROMIUM_PATH` points the suite at a Chromium you already have. `LINEAGE_HTML` and `LINEAGE_FIXTURES` override the two locations.

`make_fixtures.py` hand-builds 16 fixtures byte by byte with no image or document libraries. The 200 MB fixture is generated rather than stored.

The suite has two known holes. It never exercises the hand-written SHA-256 fallback or the inflation-absent path, because `crypto.subtle` and `DecompressionStream` are present in every normal browser. Both paths were validated by hand and the results are in `docs/VERIFICATION_RECORD_2026-08-24.md`. Read that before quoting the number 155.

## Documentation

| File | What it is |
| --- | --- |
| `docs/DEFECT_AUDIT_v1.md` | Audit of the v1.0 specification. Four critical and four high-severity byte-format defects, each with the corrected value |
| `docs/BUILD_NOTES_v1.md` | Every deviation from the specification, traced to the audit finding that caused it |
| `docs/VERIFICATION_RECORD_2026-08-24.md` | Both harness runs, the environment, and the coverage gaps stated plainly |

Session working notes are kept out of this repository on purpose. Where the documents reference a handoff document, that is the unpublished one.

## Status

`1.1.0-rc3` is a release candidate. Four specification decisions are owed by the sponsor before the version moves, and they are listed in the audit disposition. Verification does not promote a build.

## Authority

Paragraph text is summarised rather than quoted, except where noted. Confirm every citation against the source before it goes into anything signed.

### NAVMC 5239.1, United States Marine Corps Guidance on Generative Artificial Intelligence, 4 December 2024

[Publication page](https://www.marines.mil/News/Publications/MCPEL/Electronic-Library-Display/Article/4013464/navmc-52391/)

| Paragraph | Summary |
| --- | --- |
| 4.a.(2) | Users are able to readily determine which systems rely on generative AI, and to accept or reject the output |
| 4.a.(7) | Provide transparency and explainability for model outputs as required, including data lineage, documentation on model training data, and specification of which components leverage generative AI |
| 4.b.(4) | Users are responsible for products and decisions made with the assistance of generative AI, and should distrust and verify all outputs prior to use |
| 4.b.(5) | Users label any document created, in whole or in part, with outputs from generative AI tools. This is the requirement Module 2 formats |

### MARADMIN 635/24, Guiding Principles for the Ethical Use of Artificial Intelligence by Communication Strategy and Operations

Date-time group R 301807Z DEC 24, released 30 December 2024. [Message](https://www.marines.mil/News/Messages/Messages-Display/Article/4018332/guiding-principles-for-the-ethical-use-of-artificial-intelligence-by-communicat/)

The operative sentence, quoted because the exact wording matters: "Products adjusted with AI will annotate that adjustment in both caption and metadata (e.g., basic correction of color done with AI)."

The duty reaches metadata, not the caption alone. That is the half LINEAGE reads.

**Cite 635/24, not 602/24.** [MARADMIN 602/24](https://www.marines.mil/News/Messages/Messages-Display/Article/4001021/guiding-principles-for-the-ethical-use-of-artificial-intelligence-by-communicat/) carried the identical title and is marked cancelled at its source. The [cancellation](https://www.marines.mil/News/Messages/Messages-Display/Article/4018003/cancellation-of-maradmin-60224/) carries date-time group R 301748Z DEC 24, nineteen minutes before 635/24 was released.

Two caveats a careful reader should have:

1. **635/24 declares no supersession of its own.** The reissue relationship rests on the identical title, the nineteen-minute gap, and the carried-forward text, not on any statement inside the message.
2. **The cancellation message displays under the identifier MARADMIN 028/24** while carrying a December date-time group. That inconsistency is in the source page. Confirm the number against the official MARADMIN index before citing it in a signed document.

### Scope

LINEAGE contains no model, performs no inference, and holds no training data. It is a deterministic byte parser. The position taken here is that the AI tool tracking requirement in paragraph 4.c.(6) does not attach to a tool containing no model. That determination rests with the fielding command rather than with this repository.

## Licence

MIT. See `LICENSE`.
