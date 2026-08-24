# LINEAGE Developer Handoff v1.0 draft, Defect Audit

Auditor pass date: 24 August 2026
Audited document: LINEAGE Developer Handoff, version 1.0 draft, 23 August 2026
Verdict: do not hand off as written. Four critical or high byte-format errors will produce a build passing your acceptance tests while silently failing to detect the primary signal the tool exists to find.

Findings are ordered by severity. Each carries the corrected value.

---

## 1. Critical defects

### C-1. Section 6.2, wrong offset for the C2PA box type in JPEG

Your text: "Read the box length and the four-character type at payload offset 4."

The APP11 payload layout under ISO/IEC 19566-5 and the C2PA JPEG binding is:

| Offset | Bytes | Field |
| --- | --- | --- |
| 0 | 2 | Common identifier, ASCII `JP` |
| 2 | 2 | Box instance number, big-endian |
| 4 | 4 | Packet sequence number, big-endian |
| 8 | 4 | LBox, total box length, big-endian |
| 12 | 4 | TBox, four-character type, `jumb` |

Offset 4 holds the packet sequence number, not the type. A developer following your text reads four bytes of a sequence counter, compares them to `jumb`, gets no match, and reports no content credential. Every C2PA-bearing JPEG returns a clean inspection.

Correction: read TBox at payload offset 12. Validate the ASCII `JP` at offset 0 first. Read LBox at offset 8 for the manifest length.

Severity rationale: this failure mode is silent and inverts the tool's core claim. Section 0.3 promises absence of findings is never reported as a clean result, and this defect breaks the promise at the byte level.

### C-2. Section 6.2, multi-segment JUMBF reassembly is absent

A JPEG APP segment payload caps at 65533 bytes. Production C2PA manifests routinely exceed this and split across several APP11 segments sharing one box instance number, ordered by the packet sequence number at offset 4.

Consequences of the omission:
- The reported manifest byte length comes from a single segment length rather than from LBox, understating the manifest.
- Any claim generator string crossing a segment boundary becomes unreadable, and the parser reports nothing rather than reporting a limit.

Correction: group APP11 segments by box instance number, order by packet sequence number, concatenate payload bytes from offset 8 onward for the first segment and offset 8 onward for continuations, and take the manifest length from LBox in the first segment. Where the concatenated length falls short of LBox, emit a `limits` entry reading `c2pa-manifest-truncated`.

### C-3. Section 6.7 and tests 7 and 11, C2PA presence is treated as an AI signal

Your rule: "`aiSignal` is set true only for an explicit C2PA manifest, an IPTC DigitalSourceType with a trained-algorithmic value, or a claim generator string."

Content credentials are a provenance format, not an AI format. Cameras from Leica, Sony, Nikon, and Canon sign captures with C2PA manifests carrying no AI involvement. Under your rule a photograph shot on a signing camera returns `aiSignal: true`.

The error is then written into two acceptance gates:
- Test 7: "JPEG carrying a C2PA manifest. Reports the APP11 JUMBF box, manifest length, and aiSignal true."
- Test 11: same construction for docx.

A build passing these tests is a build producing false AI attributions on authentic camera originals. In a compliance tool routing to a record folder, a false positive is more damaging than a miss, because it puts an unfounded assertion into a filed attestation.

Correction:
- C2PA manifest presence sets category `provenance`, not `aiSignal`.
- `aiSignal` is set true only for an IPTC `DigitalSourceType` resolving to `trainedAlgorithmicMedia` or `compositeWithTrainedAlgorithmicMedia`, or for a C2PA assertion of the same values.
- A claim generator string is reported verbatim under `provenance` with no inference. A claim generator naming a generative tool is operator-visible without the tool asserting anything.
- Rewrite tests 7 and 11 to require `aiSignal: false` for a camera-signed C2PA file and `aiSignal: true` only for a file carrying a trained-algorithmic DigitalSourceType.

### C-4. Section 6.5, encrypted PDFs produce fabricated verbatim values

A PDF carrying `/Encrypt` in its trailer encrypts all strings, including `/Author`, `/Producer`, and `/Title`, even when the file opens with no password. Your parser resolves `/Info`, finds string objects, and reports the decrypted-looking bytes verbatim per the section 6.7 rule against normalization.

The output is ciphertext presented to a Marine as a document author field.

Section 6.5 names the not-present versus not-readable distinction as the single most important correctness property of the module. This defect violates it in the worst direction, producing content where the honest answer is unreadable.

Correction: detect `/Encrypt` in the trailer before resolving `/Info`. Where present, emit `limits` entry `pdf-encrypted-strings-unreadable` and report zero authorship findings from the Info dictionary.

---

## 2. High severity defects

### H-1. Section 6.2, the JPEG segment walk desynchronizes on standalone markers

Your text: "Each marker is FF followed by a marker byte, then a two-byte big-endian length inclusive of the length field."

False for standalone markers carrying no length field:
- `FF D8` SOI
- `FF D9` EOI
- `FF 01` TEM
- `FF D0` through `FF D7`, RST0 through RST7

Legal JPEGs also permit any number of `FF` fill bytes before a marker byte. A parser reading two length bytes after a standalone marker consumes image data as a length and walks off into arbitrary offsets.

Correction: skip fill `FF` bytes, branch on the marker byte, and treat `D0`-`D9` and `01` as zero-length. Guard the length value at a minimum of 2 and abort the walk on a shorter value with a `malformed-jpeg-segment` limit.

### H-2. Section 6.3, the EXIF parser is reused against the wrong start offset

Section 6.2 instructs parsing "the TIFF header at payload offset 6", correct for JPEG APP1 because `Exif\0\0` occupies six bytes. Section 6.3 then says of the PNG `eXIf` chunk: "Contains a TIFF structure. Reuse the IFD0 parser from 6.2."

The PNG `eXIf` chunk carries no `Exif\0\0` prefix. Its TIFF header starts at chunk data offset 0. Reusing a parser hard-coded to skip six bytes reads into the middle of IFD0 and yields either nothing or fabricated tag values.

Correction: factor the TIFF reader to accept a buffer and an explicit TIFF-start offset. Pass 6 for JPEG APP1 and 0 for PNG `eXIf`.

### H-3. Section 6.4, ZIP entry offsets are taken from the wrong header

Your text directs reading the central directory for file names and compression methods, then reading stored entries directly.

The central directory supplies the relative offset of the local file header, not the offset of the entry data. Entry data begins at that offset plus 30 bytes plus the local header's own filename length and extra field length, read at local header offsets 26 and 28. The local extra field frequently differs in length from the central directory extra field, because ZIP writers place different extras in each. Office writers do exactly this.

A developer computing data offsets from central directory lengths reads a few bytes into or past the intended start on real docx files.

Correction: seek to the local header offset, validate signature `50 4B 03 04`, read the two length fields at local offsets 26 and 28, and compute the data start from those.

### H-4. Section 6.3, zTXt and compressed iTXt are surrendered without cause

Your developer note: "`zTXt` and compressed `iTXt` use zlib deflate. Without a library, report the chunk as present and compressed rather than decompressing."

Section 6.4 already instructs the developer to use `DecompressionStream` for ZIP entries. The same API handles zlib streams with format `deflate`. The PNG case needs `deflate` and the ZIP case needs `deflate-raw`, and both ship in the same browser.

Your specification surrenders a capability already present in the platform, in the one chunk type most likely to hold generation parameters. Stable Diffusion and ComfyUI write prompt and workflow data into `tEXt` and compressed `iTXt`.

Correction: inflate `zTXt` and compressed `iTXt` with `DecompressionStream('deflate')`. Retain the unreadable-compressed limit only for the case where the API is absent or inflation throws.

---

## 3. Medium severity defects

### M-1. Section 6.3, the iTXt field layout is under-specified

`iTXt` is not a keyword and value pair. Its layout is: keyword, null, compression flag byte, compression method byte, language tag, null, translated keyword, null, then text. Treating it like `tEXt` reports the compression flag and language tag as part of the value.

Correction: specify the field walk explicitly in section 6.3.

### M-2. Section 6.5, "trailer" is ambiguous in incrementally updated PDFs

A PDF revised in place carries multiple `trailer` keywords, each pointing at a prior cross-reference section. Taking the first or the last literal occurrence yields the wrong `/Info` in a document with an update history.

Correction: read `startxref` at the file tail, follow the cross-reference chain through `/Prev`, and resolve `/Info` from the most recent trailer. Where the chain is unfollowable, emit a limit.

### M-3. Section 6.6, "outside an object stream" is the wrong term

Your text: "Any XMP packet outside an object stream is readable as UTF-8 XML."

XMP in a PDF normally lives in a top-level stream object carrying `/Type /Metadata`, and compression comes from a stream filter such as `/FlateDecode`, not from residence in an object stream. The two mechanisms are unrelated, and the wording sends the developer looking for the wrong condition.

Correction: state the actual test. An XMP packet is readable when its `<?xpacket begin` marker appears in the raw bytes. Compressed metadata streams show no such marker and get reported as a limit.

### M-4. Section 6.7 versus PDF string encoding, the no-normalization rule breaks readability

PDF text strings holding non-ASCII authorship data are UTF-16BE with a leading `FE FF` byte order mark, or hexadecimal strings of the form `<FEFF0053...>`. Rendering those bytes as UTF-8 per the verbatim rule produces unreadable output for exactly the fields the operator needs.

Correction: report both. Emit the decoded value as `value` and the raw byte form as an adjacent `rawValue` field, and label the encoding. The audit trail keeps the bytes and the operator keeps a readable field. This needs a sponsor decision, since it amends the section 6.7 rule.

### M-5. Section 8.2, `crypto.subtle` has no fallback while section 10.2 mandates file:// operation

Both Chrome and Firefox treat `file://` as a secure context, so `crypto.subtle` is normally present. The residual risk is enterprise policy or a hardened baseline browser removing it. Under your design the loss takes down module 3 entirely, and module 3 is the auditable record.

Correction: implement a hand-written SHA-256 in the same file as a fallback. Constraint 6 forbids third-party code, not hand-written code, so the fallback is compliant. The attestation states which implementation produced the digest.

### M-6. Section 10.15, the 200 MB case has no memory strategy

Reading 200 MB into an ArrayBuffer, then decoding the whole buffer to a string for PDF token scanning, materializes a second allocation of comparable size plus decoder intermediates. The result is multi-second main-thread freezes and, on constrained workstations, a tab crash. Your acceptance criterion says neither crashes the page, and nothing in the specification says how.

Correction: scan in fixed-size windows with an overlap equal to the longest search token, never materializing the full buffer as a string. Hash in a single pass. Above a size threshold, restrict textual scanning to the head and tail regions and record the restriction as a limit.

### M-7. Section 7.2, the template says "undersigned" with nothing signed

Line 7 assigns responsibility to "the undersigned reviewing official." The block carries no signature line. A record document referring to an undersigned party with no signature block invites the exact audit finding the tool exists to prevent.

Correction: either add a signature and date line to the template, or change line 7 to name the reviewing official at line 5 by reference.

### M-8. Section 7.1, the label form has no document date

An annotation naming a title and no date attaches to any revision of a document carrying that title. Add a document date field, required.

### M-9. Section 8.3, local ISO 8601 without an offset is ambiguous in a record

Correction: render the timestamp with an explicit UTC offset, and print the Zulu equivalent on the same line.

---

## 4. Specification gaps

### G-1. Section 5 and 6.1 name `parseTextual`, section 6 defines no behavior for it

The architecture diagram and the format detection table both route plain text and markdown to a parser with no specified output. A developer will either skip it or invent behavior.

Recommended scope, pending your decision: detect and report zero-width and bidirectional control characters at U+200B, U+200C, U+200D, U+2060, U+FEFF, U+202A through U+202E, with codepoint and byte offset. Detection sits squarely inside the section 0.1 mission. Removal stays rejected under section 11. Reporting the presence of an invisible character is a lineage finding.

### G-2. Format coverage omits the containers where content credentials most often appear

Section 6.1 handles JPEG, PNG, OOXML, PDF, and text. It omits TIFF, WebP, HEIC, AVIF, and MP4 or MOV. Content credentials are common in HEIC and in video. A tool built to inspect provenance and silently unable to read an iPhone HEIC will be read by users as reporting a clean file.

Minimum correction for v1: detect these signatures and report `format-unsupported-in-v1` as a limit rather than falling through to textual decoding. Full parsing goes to v2.

### G-3. Section 6.4 lists only Word paths

Section 6.1 distinguishes word, spreadsheet, and presentation packages, then section 6.4 specifies only `word/` paths for revision and comment detection. Add `xl/workbook.xml`, `xl/sharedStrings.xml`, `ppt/presentation.xml`, and `ppt/notesSlides/` equivalents, or state explicitly the revision checks apply to Word packages alone.

### G-4. No malformed input handling anywhere in section 6, and no test for it

The tool reads untrusted files. Section 6 specifies no behavior for truncated segments, negative or oversized lengths, cyclic references, or a ZIP central directory pointing outside the buffer. Section 10 contains no malformed-input test.

For a read-only browser tool the risk is a hung tab, not code execution, but a hung tab during a records review is still a failure.

Correction: add a bounds guard on every offset read, an iteration cap on every walk loop, and acceptance test 18 covering a truncated JPEG, a docx with a corrupted central directory, and a PDF with a broken xref chain.

---

## 5. Acceptance criteria defects

### A-1. Test 5 is vacuous

"The input file byte length and SHA-256 are identical before and after inspection."

The page never holds a handle to the file on disk. It reads a copy into memory. The test verifies nothing about the code under test and passes unconditionally.

Correction: re-hash the ArrayBuffer after parsing completes and compare to the digest computed at load. That version tests the read-only property of the parsers.

### A-2. Test 1 is not executable as written

A substring scan for `fetch`, `caches`, and `import(` produces false positives against ordinary identifiers and comment text. An acceptance gate needs a deterministic pass or fail.

Correction: specify the scan as word-boundary regular expressions against the source, and list the exact patterns. Publish the expected count of zero per pattern.

### A-3. No test covers the not-readable versus not-present rendering

Section 6.5 names this the single most important correctness property. Tests 9 and 13 verify the `limits` array is populated. Neither verifies the interface renders unknown differently from clean, which is where the property actually lands for the operator.

Correction: add a test asserting the interface displays distinct wording and distinct visual treatment for a zero-finding zero-limit parse versus a zero-finding populated-limit parse.

### A-4. Test 11 requires a fixture unlikely to exist

No widely deployed C2PA binding for OOXML packages is in production. Sourcing a docx carrying a C2PA part for the test suite is impractical.

Correction: restate as a generic detection requirement. Any ZIP entry whose name or content type contains `c2pa` gets reported as a provenance finding. Test with a hand-built fixture rather than a real generated document.

---

## 6. Policy and authority findings

### P-1. Open item 13.1 is closed. Answer below.

- MARADMIN 602/24, GUIDING PRINCIPLES FOR THE ETHICAL USE OF ARTIFICIAL INTELLIGENCE BY COMMUNICATION STRATEGY AND OPERATIONS, dated 17 December 2024, was cancelled by a cancellation message with date-time group R 301748Z DEC 24.
- Nineteen minutes later, R 301807Z DEC 24, MARADMIN 635/24 reissued the guiding principles under the identical title.
- MARADMIN 635/24 carries the annotation requirement forward verbatim: "Products adjusted with AI will annotate that adjustment in both caption and metadata, e.g., basic correction of color done with AI."

Consequence for LINEAGE: the COMMSTRAT annotation requirement is live, and it is a metadata requirement, not only a caption requirement. Cite MARADMIN 635/24. Do not cite 602/24.

One caution before you cite anything in a released version. The Marine Corps message display page renders the cancellation message identifier as 028/24 while carrying a December 2024 date-time group, an internal inconsistency in the source page. Pull the official message from the MARADMIN index and confirm the number before it goes into a signed document.

### P-2. Section 2 authority text verified

NAVMC 5239.1, UNITED STATES MARINE CORPS GUIDANCE ON GENERATIVE ARTIFICIAL INTELLIGENCE, 4 December 2024, is active. The four cited paragraphs read as follows.

- 4.a.(2): users are able to readily determine which systems rely on GenAI and are able to accept or reject the output.
- 4.a.(7): provide transparency and explainability for model outputs as required, including data lineage, documentation on model training data, and specification of which components leverage GenAI.
- 4.b.(4): users are responsible for products and decisions made with the assistance of GenAI, and should distrust and verify all outputs prior to use.
- 4.b.(5): users label any document created, in whole or in part, with outputs from GenAI tools.

Your section 1 problem statement and your section 7 label template both track the source text correctly.

### P-3. Open item 13.4, your recommended position rests on the wrong argument

You propose LINEAGE falls outside paragraph 4.c.(6) because it makes no model calls. The paragraph directs commands to "track and manage AI tools, articulate what AI tools are being developed, and how the AI tools will be utilized." Nothing in the wording turns on model calls, and the paragraph says AI tools rather than GenAI tools.

Stronger position: LINEAGE contains no model, performs no inference, and holds no training data. It is a deterministic byte parser. It is not an AI tool, so the tracking requirement never attaches. Keep the no-model constraint in section 4, and re-base the argument on the absence of a model rather than on the absence of a call.

### P-4. Section 8.4 clipboard-only delivery has a field failure mode

Clipboard transfer through some VDI and thin-client sessions truncates or drops long text. An attestation reaching the record folder incomplete is worse than one never generated, because the truncation is invisible to the operator.

Correction routed to the sponsor: add a print path using a print stylesheet. Printing writes no file from the page, makes no network request, and stores nothing, so it violates no constraint in section 4. It gives the operator a paper or print-to-PDF route independent of clipboard behavior.

### P-5. Section 8.3 disclaimer omits the operator identity caveat

The mandatory disclaimer covers signature validation and file modification. It says nothing about the operator field, which is unvalidated free text. Add one line: operator identity is self-asserted and unverified by this tool.

### P-6. Section 9, cite the current accessibility target

Section 508 incorporates WCAG 2.0 Level AA by reference. WCAG 2.0 AA omits focus-visible and reflow criteria your interface will need. State WCAG 2.1 Level AA as the build target.

---

## 7. What survives the audit unchanged

Earned, with the reasons.

- Section 0.3 and section 11. The refusal to build stripping capability is correct, and the stated rationale, a removal capability creates the documentation gap and the gap becomes the audit finding, holds up.
- Section 6.7 `limits` as mandatory output, with zero findings plus zero limits meaning clean and zero findings plus populated limits meaning unknown. This is the single best design decision in the document. My defects C-4, H-4, and G-2 are all cases where the specification fails to honor its own rule.
- Section 7.2 suppression of the label block when scope is `none`. Refusing to generate a negative assertion is correct. Add interface wording stating why no block appeared, since the operator completes seven required fields and otherwise receives silence.
- Section 0.6 naming discipline. The prediction, a function named `cleanMetadata` gets read as a missing feature and implemented, is accurate.
- Section 8.2 hashing before parsing.
- Detection by magic bytes rather than extension.

---

## 8. Disposition

Blocking before build: C-1, C-2, C-3, C-4, H-1, H-2, H-3.
Blocking before fielding: A-1, A-3, G-1, G-4, P-1.
Sponsor decision required: M-4, P-4, G-1 scope, G-2 v1 boundary.

Confidence in the byte-format findings: 0.95. Sections C-1, H-1, H-2, and H-3 are verifiable against the format specifications and against test fixtures.
Confidence in the policy findings: 0.85. P-1 rests on the Marine Corps message display pages, and the identifier inconsistency noted there needs your confirmation against the official message.
