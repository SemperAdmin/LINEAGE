# Design rationale and constraints

The full text behind the short summary in the README: why LINEAGE exists, the two rules it will not bend, and the acceptance gates every build must pass.

## Why this exists

NAVMC 5239.1 puts the labelling duty on the person, not on a tool. Paragraph 4.b.(5) requires a label on any document created, in whole or in part, with output from a generative AI tool, and paragraph 4.b.(4) puts responsibility for the product on whoever used one.

Labelling a document honestly means knowing what it already declares about its own origin. That data sits in structures no ordinary application surfaces: EXIF and XMP in images, C2PA content credentials, Office document properties, tracked changes and comment authors, PDF information dictionaries, and invisible characters inside plain text. Word does not show it. Acrobat does not show it. A photo viewer does not show it.

The usual way to see it is to upload the document to an online metadata reader, which is the wrong trade for anything heading to a record folder.

LINEAGE reads the file in the browser, on the machine, with no network. Then it stops short of the line a tool should not cross.

**It will not decide whether AI wrote a passage.** No metadata field records that. A tool inferring it would manufacture the very assertion the annotation exists to make. Contribution scope, portion affected, reviewer, and the accuracy confirmation stay with the operator, and the attestation records that they came from a person rather than from the file.

**It will not report a quiet result as a clean one.** Zero findings with zero limits means clean. Zero findings with limits recorded means unknown. Everything the parse was unable to read is listed by name, because unread is not the same as absent.

**It will not vouch for a content credential.** A C2PA manifest is reported as present and never validated, and the attestation says so.

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
