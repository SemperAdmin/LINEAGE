# LINEAGE, Verification Record

Run date: 24 August 2026

## Current build

| Field | Value |
| --- | --- |
| Version | `1.1.0-rc2` |
| Size | 112,502 bytes |
| SHA-256 | `B0011F8BFAA7CD600E5AF1687C1B3F1AC5B80E98E5C9FF15288B5C7B298CAAB2` |
| Result | 155 passed, 0 failed |

## Superseded build

| Field | Value |
| --- | --- |
| Version | `1.1.0-rc1` |
| Size | 104,125 bytes |
| SHA-256 | `286B95EE42C7CEA1158A3E9006A76C3F74F0BEB6C4079821B5513C8B89B1A8C4` |
| Result | 155 passed, 0 failed |

Any attestation issued before 24 August 2026 quotes `rc1` as the tool version. That is correct for those records and must not be retroactively edited. `rc1` is not on disk any more.

---

## 1. What changed between rc1 and rc2

Cosmetic only. No parser, constraint, or derivation logic was touched.

1. Semper Admin logo added to the topbar as an embedded `data:image/png;base64` URI, 108 by 96 pixels, 96-colour palette PNG with an alpha channel, 5,777 bytes raw and 7,726 characters encoded. Rendered at 40 pixels, 32 on mobile.
2. Wordmark became a two-line lockup, `Lineage` over `by Semper Admin`.
3. Version string bumped so two different artifacts never claim one version.

Net growth: 8,377 bytes, an 8.0 percent increase.

The logo is embedded, not referenced. Constraint 1 still holds, one file. Constraint 2 still holds, and the network gate confirmed it: across the whole rc2 run the browser made zero non-local requests, and a dedicated render observed one request total, the `file://` page load itself.

Byline colour is `--color-muted-foreground`, measured at 6.92:1 on the dark topbar and 7.40:1 on the light one. Both clear WCAG AA for normal text.

---

## 2. Gate coverage, unchanged across both runs

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

## 3. Two checks the suite does not make, run by hand against rc1

The suite is silent on both degraded paths below. Neither was re-run against rc2, and neither needs to be, because rc2 changed no code on either path.

### 3.1 Hand-written SHA-256

`crypto.subtle` was available throughout the suite, so `sha256Manual` never executed. It was forced by removing `crypto.subtle` before page load. Output was compared against coreutils `sha256sum`:

| Fixture | In-page digest | Matches coreutils |
| --- | --- | --- |
| `16b_plain_text_clean.txt` | `45ab5a46...81cad19` | yes |
| `10_docx_author_tracked.docx` | `5904555d...9b124fcc` | yes |
| `15_zero_byte.bin` | `e3b0c442...7852b855` | yes |

The interface correctly labeled the digest source as `in-page SHA-256 (crypto.subtle unavailable)` in all three.

### 3.2 Inflation absent

`DecompressionStream` was deleted before page load, then two fixtures were inspected. The build reported unknown rather than clean in both, which is the central design rule holding under a degraded environment.

- `09_png_ztxt_compressed.png`: verdict "Result is partly unknown", 2 limits naming both the zTXt and iTXt keywords.
- `10_docx_author_tracked.docx`: verdict "Result is partly unknown", 10 limits naming every unreadable ZIP entry by path, plus `ooxml-core-properties-unreadable`.

No finding was emitted asserting absence in either case.

---

## 4. Coverage gaps, stated plainly

1. **The suite has no negative-path coverage.** Both checks in section 3 sit outside `test_lineage.js`. Fold them in as permanent checks, taking the suite to 157. Without them, a regression removing the fallback digest path or the unreadable-versus-absent handling passes 155 of 155.
2. **Platform.** Constraint 7 is proven on Linux Chromium 1194 from a `file://` path. It is not proven in the browser of record on the Windows workstation. That check still needs a human at the machine.
3. **The 200 MB fixture is 200 MB of `0x41`.** It exercises buffer handling and the size ceiling, not a large document with real structure.
4. **Storage checks are strong in these runs, not vacuous.** `localStorage`, `sessionStorage`, and `indexedDB.databases` were all writable and available in the `file://` context, and all read back empty after every inspection. A run where storage is blocked outright would pass these checks without proving anything.
5. **No visual regression test exists.** The topbar lockup was confirmed by screenshot in dark, light, and 390-pixel-wide viewports, by eye. Nothing in the suite would catch a future layout break.

---

## 5. Bearing on release

The build is verified against its acceptance criteria. Verification does not move it off a release candidate. The four decisions in section 7 of the handoff are still owed by the sponsor, and those are what promote the version.
