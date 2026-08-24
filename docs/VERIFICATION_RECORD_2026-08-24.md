# LINEAGE, Verification Record

Run date: 24 August 2026

## Current build

| Field | Value |
| --- | --- |
| Version | `1.1.0-rc3` |
| Size | 119,426 bytes |
| SHA-256 | `5D5A25BE0AE955C268461215031355FAF146F24D87DF335D615FB87A4BA1AD39` |
| Result | 155 passed, 0 failed |

## Superseded builds

| Version | Size | SHA-256 | Result |
| --- | --- | --- | --- |
| `1.1.0-rc2` | 112,502 bytes | `B0011F8B...B298CAAB2` | 155 passed, 0 failed |
| `1.1.0-rc1` | 104,125 bytes | `286B95EE...B89B1A8C4` | 155 passed, 0 failed |

Every attestation quotes the tool version that produced it. Those records are correct as issued and must not be retroactively edited. Only `rc3` is on disk and in the repository.

---

## 1. Change history

### rc1 to rc2, cosmetic

Semper Admin logo added to the topbar as an embedded `data:image/png;base64` URI, 108 by 96 pixels, 96-colour palette PNG with alpha, 5,777 bytes raw. Wordmark became a two-line lockup, `Lineage` over `by Semper Admin`. No parser, constraint, or derivation logic touched. Net growth 8,377 bytes.

### rc2 to rc3, content

Two panels added, both marked `noprint`, so the printed attestation record is byte-identical to what rc2 produced.

1. **Context panel** above Module 1. Two sentences of standing text, with the detailed reasoning behind a native `<details>` disclosure.
2. **Authority panel** above the footer. NAVMC 5239.1 paragraph summaries and the MARADMIN 635/24 citation.

Net growth 6,924 bytes. No parser, constraint, or derivation logic touched.

**Every citation is unlinked text.** An `<a href="https://...">` inside `index.html` fails acceptance gate 1, which matches `href="https://` under its remote-attribute-reference check. Anyone adding a linked citation to the app will break the constraint scan. Links belong in the README.

**A layout regression was caught and fixed before release.** With the reasoning expanded inline, the file picker fell to y=1415 in a 900-pixel desktop viewport and y=2340 in an 844-pixel mobile viewport, putting the tool's primary control roughly three screens below the fold on a phone. Moving the reasoning behind `<details>` returned it to y=660 and y=769 respectively, visible on load in both. The disclosure uses no script and no storage.

---

## 2. Citations verified against source

The defect audit recorded these findings at 0.85 confidence and flagged a source inconsistency. All were checked against marines.mil before publication. One audit claim did not survive.

| Claim | Status |
| --- | --- |
| NAVMC 5239.1, title and number, dated 4 December 2024 | Confirmed |
| MARADMIN 635/24, identical title, DTG R 301807Z DEC 24, released 30 December 2024 | Confirmed |
| Annotation sentence carried in 635/24, reaching metadata and not the caption alone | Confirmed verbatim |
| MARADMIN 602/24 carries the identical title and is marked cancelled | Confirmed |
| Cancellation DTG R 301748Z DEC 24, nineteen minutes before 635/24 | Confirmed |
| Cancellation message displays under the identifier MARADMIN 028/24 against a December DTG | Confirmed. The inconsistency is real and sits in the source page |
| **635/24 reissued the principles, superseding 602/24** | **Not supported.** 635/24 declares no supersession of its own |

The last row changed the published wording. The reissue relationship is now stated as an inference resting on the identical title, the nineteen-minute gap, and the carried-forward text, rather than as something the message says. Both the app and the README carry that qualification, and both instruct the reader to confirm the number against the official MARADMIN index before citing it in a signed document.

---

## 3. Gate coverage, unchanged across all three builds

| Gate | Coverage |
| --- | --- |
| 1 | Constraint verification by static source scan, 22 checks |
| 3 | Network, zero non-local requests |
| 4 | Storage panel, 4 checks |
| 5 | Read-only self check, buffer digest unchanged across the parse |
| 6, 7, 7b | JPEG EXIF, multi-segment C2PA JUMBF, camera C2PA with no false AI attribution |
| 8, 8b, 9 | PNG tEXt, eXIf at chunk offset 0, caBX, inflated zTXt and iTXt |
| 10, 11 | Office Open XML metadata, tracked changes, C2PA part |
| 12, 13, 13b | PDF /Info, compressed cross-reference stream, encrypted PDF |
| 14 | Magic-byte detection over a mismatched extension |
| 15a, 15b | Zero-byte file, 200 MB file |
| 16, 17 | Label module, attestation |
| G-1 | Invisible and bidirectional character detection |
| D, D2, D3, D4 | Derivation, override tracking, field provenance, fallbacks |

The 200 MB inspection completed in 4,203 ms against a 120,000 ms ceiling.

Environment: Chromium 1194 launched with `--no-sandbox --allow-file-access-from-files`, page served from a `file://` path, Node 22.22.2, Python 3.11.15, Linux container. `DecompressionStream` and `crypto.subtle` both present.

---

## 4. Two checks the suite does not make, run by hand

The suite is silent on both degraded paths below. They were run against `rc1`. Neither has been re-run since, and neither needs to be, because no later change touched either path.

### 4.1 Hand-written SHA-256

`crypto.subtle` is available throughout the suite, so `sha256Manual` never executes. It was forced by removing `crypto.subtle` before page load, and its output compared against coreutils `sha256sum`:

| Fixture | In-page digest | Matches coreutils |
| --- | --- | --- |
| `16b_plain_text_clean.txt` | `45ab5a46...81cad19` | yes |
| `10_docx_author_tracked.docx` | `5904555d...9b124fcc` | yes |
| `15_zero_byte.bin` | `e3b0c442...7852b855` | yes |

The interface correctly labelled the digest source as `in-page SHA-256 (crypto.subtle unavailable)` in all three.

### 4.2 Inflation absent

`DecompressionStream` was deleted before page load, then two fixtures inspected. The build reported unknown rather than clean in both, which is the central design rule holding under a degraded environment.

- `09_png_ztxt_compressed.png`: verdict "Result is partly unknown", 2 limits naming both the zTXt and iTXt keywords.
- `10_docx_author_tracked.docx`: verdict "Result is partly unknown", 10 limits naming every unreadable ZIP entry by path, plus `ooxml-core-properties-unreadable`.

No finding asserting absence was emitted in either case.

---

## 5. Coverage gaps, stated plainly

1. **The suite has no negative-path coverage.** Both checks in section 4 sit outside `test_lineage.js`. Fold them in as permanent checks, taking the suite to 157. Without them, a regression removing the fallback digest path or the unreadable-versus-absent handling still passes 155 of 155.
2. **Platform.** Constraint 7 is proven on Linux Chromium 1194 from a `file://` path. It is not proven in the browser of record on the target workstation. That check needs a human at the machine.
3. **The 200 MB fixture is 200 MB of `0x41`.** It exercises buffer handling and the size ceiling, not a large document with real structure.
4. **Storage checks are strong in these runs, not vacuous.** `localStorage`, `sessionStorage`, and `indexedDB.databases` were all writable and available in the `file://` context, and all read back empty after every inspection. A run where storage is blocked outright would pass these checks without proving anything.
5. **No visual or layout regression test exists.** The rc3 fold regression was caught by measuring the file picker's position by hand, not by the suite. Nothing in `test_lineage.js` would have failed on it. A check asserting the picker sits above the fold at a 390-pixel width would be cheap and would have caught it.
6. **No check asserts the print output is unchanged.** Both rc3 panels are marked `noprint`, and that was verified by reading the markup rather than by rendering to paper.

---

## 6. Bearing on release

The build is verified against its acceptance criteria. Verification does not move it off a release candidate. The four decisions in the audit disposition are still owed by the sponsor, and those are what promote the version.
