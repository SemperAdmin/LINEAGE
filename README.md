# LINEAGE

Reads the provenance metadata a document already carries and helps you write the generative AI use label that NAVMC 5239.1 paragraph 4.b.(5) requires, for Marines who create or review documents. One HTML file; it reads your file in the browser and never uploads or changes it.

**Live:** https://lineage.app.cloud.gov
**Also on GitHub Pages:** https://semperadmin.github.io/LINEAGE/

## What it does

- **Inspect.** Finds the format by magic bytes, never by file extension, and parses JPEG, PNG, Office Open XML, PDF and plain text with hand-written parsers. It reports EXIF and XMP, C2PA content credentials, Office document properties, tracked changes and comment authors, PDF information dictionaries and invisible characters in text, grouped by category.
- **Label.** Fills in what the document declares about itself, names the source of each filled value, and leaves empty every field that describes human conduct (contribution scope, portion affected, reviewer and the accuracy confirmation).
- **Attest.** Produces a SHA-256 over the input, the findings, the limits, the annotation, the field provenance and a mandatory disclaimer. It goes to the clipboard or to print; no file is written.
- **Reports its limits.** Zero findings with zero limits means clean. Zero findings with limits recorded means unknown, and everything the parse could not read is listed by name.
- **Stays in its lane.** It never decides whether AI wrote a passage, because no metadata field records that. A C2PA manifest is reported as present and never validated. A C2PA credential is a provenance signal, not an AI signal: only an IPTC `DigitalSourceType` of `trainedAlgorithmicMedia` or `compositeWithTrainedAlgorithmicMedia` sets an AI flag.

## Using it

Open the live site, or download `index.html` and open it from your computer. A downloaded copy needs no server, no installation and no internet connection. Choose a file; LINEAGE inspects it, offers the label for you to complete, and produces the attestation record. The labelling duty stays with you: NAVMC 5239.1 puts it on the person, not on a tool.

The reasoning behind these rules, and the acceptance gates every build must pass, are in [docs/DESIGN.md](docs/DESIGN.md). The governing documents and what they require are in [docs/AUTHORITY.md](docs/AUTHORITY.md).

## Verifying a copy

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

For anything going into a record, use a downloaded copy whose digest you have checked. A hosted page arrives over the network, so what you ran is whatever the host served at that moment. A local file whose SHA-256 you verified against the table above is the defensible artifact, and the attestation is only as good as the provenance of the tool that produced it. The hosted copies are for trying the tool without downloading anything.

## Privacy and security

- Nothing you open leaves the browser. LINEAGE makes no network request (no fetch, XMLHttpRequest, WebSocket, sendBeacon or dynamic import, and no remote script, style or image) and uses no browser storage (no localStorage, sessionStorage, IndexedDB, cookies, Cache API or download). `index.html` contains none of those calls.
- It does not change your file: the input is re-hashed after parsing and compared with the digest taken at load, and a mismatch is shown as a read-only violation.
- It contains no model and no third-party code; every parser is hand-written.
- The cloud.gov copy enforces the zero-network property in the browser with a Content-Security-Policy set in `deploy/nginx/conf/includes/headers.conf`: `default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'; frame-ancestors 'none'`. The GitHub Pages copy cannot set headers, so it relies on the code alone.
- The hosting platforms (cloud.gov and GitHub Pages) keep standard web server access logs, such as IP address, time, requested page and browser type, for operations and security. Semper Admin does not add tracking of its own.

See [Security](SECURITY.md).

## Development

The acceptance suite is in `test-kit/`, so the gates can be re-run rather than trusted from a report. It needs Node.js, Python 3 and Playwright with a Chromium.

```bash
cd test-kit
npm install playwright
python3 make_fixtures.py
python3 -c "open('fixtures/17_large_200mb.bin','wb').write(b'A'*1024*1024*200)"
node test_lineage.js
```

Paths resolve from the script location, so a clone runs as-is. `CHROMIUM_PATH` points the suite at a Chromium you already have. `LINEAGE_HTML` and `LINEAGE_FIXTURES` override the two locations. `make_fixtures.py` builds the fixtures byte by byte with no image or document libraries; the 200 MB fixture is generated rather than stored.

The suite has two known gaps: it never exercises the hand-written SHA-256 fallback or the inflation-absent path, because `crypto.subtle` and `DecompressionStream` are present in every normal browser. Both were validated by hand; see [docs/VERIFICATION_RECORD_2026-08-24.md](docs/VERIFICATION_RECORD_2026-08-24.md) before quoting the number 155.

## Deployment

| Environment | URL | How |
|---|---|---|
| cloud.gov | https://lineage.app.cloud.gov | `deploy/manifest.yml` (staticfile buildpack); `deploy/prepare.py` stages `index.html` and refuses a file whose SHA-256 differs from the published build; manual **Deploy to cloud.gov** workflow. The sandbox is managed by the private cloudgov-redeploy repository. |
| GitHub Pages | https://semperadmin.github.io/LINEAGE/ | `.github/workflows/pages.yml` on push to `main`. It runs the same digest check (`deploy/prepare.py`) and publishes only the verified `index.html`. |

## Documentation

- [docs/DESIGN.md](docs/DESIGN.md): why LINEAGE exists, the two rules it will not bend, and the acceptance gates.
- [docs/AUTHORITY.md](docs/AUTHORITY.md): NAVMC 5239.1 and MARADMIN 635/24 citations and what they require.
- [docs/VERIFICATION_RECORD_2026-08-24.md](docs/VERIFICATION_RECORD_2026-08-24.md): the acceptance runs, the environment and the coverage gaps.

## Feedback and support

[Open an issue](https://github.com/SemperAdmin/LINEAGE/issues). Report security problems as described in [SECURITY.md](SECURITY.md).

## License and disclaimer

MIT (see [LICENSE](LICENSE)).

> This is an independent tool built to help Marines with administrative
> work. It is not an official Department of the Navy or U.S. Marine Corps
> system and is not endorsed by, affiliated with, or approved by either.
> Always confirm requirements against the current governing orders.

## Part of Semper Admin

One of the tools in the Semper Admin suite. Start at the
[Semper Admin Portal](https://semper-admin-portal.app.cloud.gov) for the
full set.
