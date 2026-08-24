# LINEAGE

Document provenance inspection. One HTML file. No server, no build step, no network, no stored state.

LINEAGE opens a file in your browser, parses the metadata the file already carries, and reports every provenance signal it finds. It then helps you produce the generative AI use annotation required by NAVMC 5239.1 paragraph 4.b.(5), and issues a hash-anchored attestation record.

It reads. It never writes to your file, never uploads it, and never stores anything.

## Current build

| Field | Value |
| --- | --- |
| Version | `1.1.0-rc2` |
| File | `lineage.html` |
| Size | 112,502 bytes |
| SHA-256 | `B0011F8BFAA7CD600E5AF1687C1B3F1AC5B80E98E5C9FF15288B5C7B298CAAB2` |
| Acceptance suite | 155 checks, 155 passed |

Verify what you downloaded before you trust it:

```
sha256sum lineage.html                      # Linux, macOS
Get-FileHash lineage.html -Algorithm SHA256 # Windows PowerShell
```

A digest that does not match the table means the file is not this build. Do not use it for a record.

## Use

Download `lineage.html` and open it. That is the whole installation. It runs from a `file://` path with no server and no internet connection.

Three modules on one page:

1. **Inspect.** Format detected by magic bytes, never by file extension. Hand-written parsers for JPEG, PNG, Office Open XML, PDF, and plain text. Findings are grouped by category, and every capability limit hit during the parse is reported separately.
2. **Label.** Fills what the document declares about itself, names the source of each filled value, and leaves empty every field describing human conduct.
3. **Attest.** SHA-256 over the input, the findings, the limits, the annotation, the field provenance, and a mandatory disclaimer. Delivered to the clipboard or to print. No file is written.

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

`1.1.0-rc2` is a release candidate. Four specification decisions are owed by the sponsor before the version moves, and they are listed in the audit disposition. Verification does not promote a build.

## Authority

- NAVMC 5239.1, United States Marine Corps Guidance on Generative Artificial Intelligence, 4 December 2024.
- MARADMIN 635/24 reissued the COMMSTRAT guiding principles on 30 December 2024 and carries the annotation requirement forward verbatim, including the metadata clause. It replaced MARADMIN 602/24, which was cancelled the same day. Cite 635/24.

LINEAGE contains no model, performs no inference, and holds no training data. It is a deterministic byte parser.

## Licence

MIT. See `LICENSE`.
