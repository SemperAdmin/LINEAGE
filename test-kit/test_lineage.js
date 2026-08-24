const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

// Paths resolve from this file's location so the suite runs from a clone.
// Override with LINEAGE_HTML and LINEAGE_FIXTURES if your layout differs.
const HTML = process.env.LINEAGE_HTML || path.resolve(__dirname, '..', 'index.html');
const FIXDIR = process.env.LINEAGE_FIXTURES || path.resolve(__dirname, 'fixtures');
const PAGE = 'file://' + HTML;
const FIX = (n) => path.resolve(FIXDIR, n);

let pass = 0, fail = 0;
const failures = [];
function check(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; failures.push(name + (detail ? ' :: ' + detail : '')); console.log('  FAIL  ' + name + (detail ? ' :: ' + detail : '')); }
}

async function loadAndInspect(page, file) {
  await page.goto(PAGE);
  await page.setInputFiles('#picker', file);
  await page.waitForFunction(() => {
    const s = document.getElementById('status').textContent;
    return s.indexOf('Inspection complete') === 0 || s.indexOf('Inspection failed') === 0;
  }, { timeout: 120000 });
  return await page.evaluate(() => {
    const rows = [...document.querySelectorAll('#findings tbody tr')].map(tr => ({
      source: tr.cells[0].textContent.trim(),
      field: tr.cells[1].textContent.trim(),
      value: tr.cells[2].textContent.trim(),
      ai: tr.classList.contains('ai')
    }));
    const limits = [...document.querySelectorAll('#limits li')].map(li => li.textContent.trim());
    const card = {};
    const dl = document.getElementById('filecard');
    for (let i = 0; i < dl.children.length; i += 2) card[dl.children[i].textContent] = dl.children[i + 1].textContent;
    return {
      rows, limits, card,
      status: document.getElementById('status').textContent,
      verdict: document.getElementById('verdict').textContent.trim(),
      panel2: !document.getElementById('panel2').hidden,
      panel3: !document.getElementById('panel3').hidden
    };
  });
}
const has = (r, sub) => r.rows.some(x => (x.source + ' ' + x.field + ' ' + x.value).includes(sub));
const aiRows = (r) => r.rows.filter(x => x.ai);
const limHas = (r, sub) => r.limits.some(l => l.includes(sub));

(async () => {
  const requests = [];
  // Set CHROMIUM_PATH to use a Chromium you already have. Otherwise Playwright's own is used.
  const launchOpts = { args: ['--no-sandbox', '--allow-file-access-from-files'] };
  if (process.env.CHROMIUM_PATH) launchOpts.executablePath = process.env.CHROMIUM_PATH;
  const browser = await chromium.launch(launchOpts);
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  page.on('request', r => requests.push(r.url()));
  const consoleErrors = [];
  page.on('pageerror', e => consoleErrors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });

  // ---- Gate 1: static source scan -------------------------------------
  console.log('\n[1] Constraint verification, static source scan');
  const src = fs.readFileSync(HTML, 'utf8');
  const banned = [
    ['\\bfetch\\s*\\(', 'fetch('],
    ['\\bXMLHttpRequest\\b', 'XMLHttpRequest'],
    ['\\bWebSocket\\b', 'WebSocket'],
    ['sendBeacon', 'sendBeacon'],
    ['\\bimport\\s*\\(', 'dynamic import('],
    ['\\blocalStorage\\b', 'localStorage'],
    ['\\bsessionStorage\\b', 'sessionStorage'],
    ['\\bindexedDB\\b', 'indexedDB'],
    ['document\\.cookie', 'document.cookie'],
    ['\\bcaches\\b', 'caches'],
    ['<script[^>]+src=', 'script src'],
    ['<link[^>]+href=', 'link href'],
    ['src\\s*=\\s*["\']https?:', 'remote src'],
    ['@import', 'css import'],
    ['showSaveFilePicker', 'File System Access write'],
    ['download\\s*=', 'anchor download']
  ];
  for (const [re, label] of banned) {
    const m = src.match(new RegExp(re, 'g'));
    check('no ' + label, !m, m ? m.length + ' occurrence(s)' : '');
  }
  // Real check, not a vacuous one: no construct that LOADS a remote resource.
  // Namespace URIs and IPTC vocabulary URIs appearing inside string literals are
  // identifiers, not loads, so the test targets loading syntax only.
  const loaders = [
    ['(?:src|href|action|formaction|poster|data)\\s*=\\s*["\']\\s*(?:https?:)?//', 'remote attribute reference'],
    ['url\\(\\s*["\']?\\s*(?:https?:)?//', 'css remote url()'],
    ['@font-face', 'font-face declaration'],
    ['new\\s+Worker\\s*\\(', 'worker load'],
    ['navigator\\.serviceWorker', 'service worker']
  ];
  for (const [re, label] of loaders) {
    const m = src.match(new RegExp(re, 'gi'));
    check('no ' + label, !m, m ? m.slice(0, 3).join(' | ') : '');
  }
  check('exactly one file, no build artifacts referenced', !/\.js["'\s>]|\.css["'\s>]|sourceMappingURL/.test(src));

  // ---- Gate 6: JPEG EXIF, no C2PA -------------------------------------
  console.log('\n[6] JPEG with EXIF and no C2PA');
  let r = await loadAndInspect(page, FIX('06_jpeg_exif_no_c2pa.jpg'));
  check('reports Make', has(r, 'NIKON CORPORATION'));
  check('reports Model', has(r, 'NIKON Z 6_2'));
  check('reports Software', has(r, 'Ver.01.40'));
  check('reports DateTime', has(r, '2026:03:11 14:02:55'));
  check('reports Artist', has(r, 'SSgt R. K. Doyle, USMC'));
  check('reports GPS presence without coordinates', has(r, 'GPSInfoIFDPointer'));
  check('reports XMP CreatorTool', has(r, 'Adobe Photoshop 26.0'));
  check('reports JPEG COM comment', has(r, 'MCBH range week'));
  check('zero AI signals', aiRows(r).length === 0, JSON.stringify(aiRows(r).map(x => x.field)));
  check('survives standalone markers and fill bytes', !limHas(r, 'jpeg-segment-desync'));
  check('panels 2 and 3 revealed', r.panel2 && r.panel3);

  // ---- Gate 7: JPEG with generative C2PA manifest ---------------------
  console.log('\n[7] JPEG carrying a multi-segment C2PA manifest declaring generative AI');
  r = await loadAndInspect(page, FIX('07_jpeg_c2pa_genai.jpg'));
  check('reports APP11 JUMBF box type', has(r, 'jumb'));
  check('reassembled from 2 segments', has(r, '2 segment(s)'));
  check('reports declared LBox length', has(r, 'declared box length'));
  check('reports claim generator verbatim', has(r, 'SomeImageGen/2.4'));
  check('aiSignal true on trained-algorithmic source type', aiRows(r).length >= 1, JSON.stringify(aiRows(r).map(x => x.value)));
  check('records the no-validation limit', limHas(r, 'not-cryptographically-validated'));

  // ---- Gate 7b: camera C2PA must NOT be an AI signal ------------------
  console.log('\n[7b] JPEG with camera-signed C2PA and no generative source type');
  r = await loadAndInspect(page, FIX('07b_jpeg_c2pa_camera_no_ai.jpg'));
  check('reports the manifest as provenance', has(r, 'jumb'));
  check('reports claim generator', has(r, 'Nikon Z6_2'));
  check('aiSignal FALSE, no false AI attribution', aiRows(r).length === 0, JSON.stringify(aiRows(r).map(x => x.field + '=' + x.value)));

  // ---- Gate 8: PNG tEXt ----------------------------------------------
  console.log('\n[8] PNG with tEXt chunks');
  r = await loadAndInspect(page, FIX('08_png_text_chunks.png'));
  check('reports Software keyword and value', has(r, 'ComfyUI'));
  check('reports Author keyword and value', has(r, 'Cpl D. Nguyen'));
  check('reports generation parameters verbatim', has(r, 'steps: 30, cfg: 7'));
  check('no AI signal inferred from a tool name', aiRows(r).length === 0);

  // ---- Gate 8b: PNG eXIf and caBX ------------------------------------
  console.log('\n[8b] PNG with eXIf chunk and a camera caBX box');
  r = await loadAndInspect(page, FIX('08b_png_exif_and_cabx.png'));
  check('eXIf parsed at chunk offset 0, Make read', has(r, 'NIKON CORPORATION'), JSON.stringify(r.rows.slice(0, 6)));
  check('eXIf Artist read', has(r, 'SSgt R. K. Doyle'));
  check('caBX reported', has(r, 'C2PA box'));
  check('tIME reported', has(r, 'last modification time'));
  check('no AI signal from a camera manifest', aiRows(r).length === 0);

  // ---- Gate 9: PNG zTXt ----------------------------------------------
  console.log('\n[9] PNG with compressed zTXt and iTXt');
  r = await loadAndInspect(page, FIX('09_png_ztxt_compressed.png'));
  check('zTXt inflated rather than surrendered', has(r, 'KSampler'), JSON.stringify(r.rows.map(x => x.field)));
  check('compressed iTXt inflated', has(r, 'MCBH-S1-07'));
  check('no unreadable-compressed limit when inflation succeeds', !limHas(r, 'ztxt-unreadable'));

  // ---- Gate 10: docx --------------------------------------------------
  console.log('\n[10] docx with populated author and tracked changes');
  r = await loadAndInspect(page, FIX('10_docx_author_tracked.docx'));
  check('detects Word package', has(r, 'Word package'));
  check('dc:creator', has(r, 'Sgt M. T. Alvarez'));
  check('cp:lastModifiedBy', has(r, 'GySgt J. A. Rivera'));
  check('cp:revision', has(r, '17'));
  check('tracked changes present', has(r, '1 insertion element(s), 1 deletion element(s)'));
  check('comment authors counted', has(r, 'Capt L. Ortiz'));
  check('w:rsid detected', has(r, 'w:rsid'));
  check('app.xml Company', has(r, 'MCBH S-1'));
  check('custom property read', has(r, 'NIPRGPT'));
  check('external relationship reported', has(r, 'marines.mil'));
  check('no AI signal inferred from a tool name in a property', aiRows(r).length === 0);
  check('deflated entries readable, no limit', !limHas(r, 'unreadable-compressed'), JSON.stringify(r.limits));

  // ---- Gate 11: docx with a C2PA part --------------------------------
  console.log('\n[11] docx with a C2PA manifest part');
  r = await loadAndInspect(page, FIX('11_docx_c2pa_part.docx'));
  check('C2PA part reported', has(r, 'c2pa.manifest'));
  check('content type declaration reported', has(r, 'declares a c2pa content type'));
  check('aiSignal true on composite trained-algorithmic', aiRows(r).length >= 1, JSON.stringify(aiRows(r).map(x => x.value)));

  // ---- Gate 12: PDF /Info --------------------------------------------
  console.log('\n[12] PDF with a plain /Info dictionary');
  r = await loadAndInspect(page, FIX('12_pdf_info_dict.pdf'));
  check('reports Producer', has(r, 'Word for Microsoft 365'));
  check('reports Author', has(r, 'Sgt M. T. Alvarez'));
  check('reports Title', has(r, 'Range Week After Action Report'));
  check('octal escape decoded in Creator', has(r, 'Microsoft'));
  check('UTF-16BE hex string decoded', has(r, 'Range'), JSON.stringify(r.rows.filter(x => x.field.includes('Subject'))));
  check('classic xref form identified', has(r, 'classic cross-reference table'));
  check('no unreadable-compressed limit', !limHas(r, 'unreadable-compressed'));

  // ---- Gate 13: PDF xref stream --------------------------------------
  console.log('\n[13] PDF with a compressed cross-reference stream');
  r = await loadAndInspect(page, FIX('13_pdf_xref_stream.pdf'));
  check('xref stream form identified', has(r, 'cross-reference stream'));
  check('reports unreadable-compressed in limits', limHas(r, 'unreadable-compressed') || limHas(r, 'xref-stream-not-resolved'), JSON.stringify(r.limits));
  check('does NOT report metadata as absent', has(r, 'not reported as absent') || limHas(r, 'not reported as absent'));
  check('verdict states the result is partly unknown', /partly unknown/i.test(r.verdict));

  // ---- Gate 13b: encrypted PDF ---------------------------------------
  console.log('\n[13b] Encrypted PDF, ciphertext must not be presented as an author field');
  r = await loadAndInspect(page, FIX('13b_pdf_encrypted.pdf'));
  check('/Encrypt detected', has(r, '/Encrypt'));
  check('encryption limit recorded', limHas(r, 'pdf-encrypted-strings-unreadable'));
  check('no /Author finding emitted', !r.rows.some(x => x.field === '/Author'), JSON.stringify(r.rows.map(x => x.field)));

  // ---- Gate 14: mismatched extension ----------------------------------
  console.log('\n[14] PNG named report.pdf');
  r = await loadAndInspect(page, FIX('14_report.pdf'));
  check('detection follows magic bytes, reports PNG', /PNG image/.test(r.card['Detected format']), r.card['Detected format']);
  check('declared extension recorded as .pdf', r.card['Declared extension'] === '.pdf');
  check('PNG chunks still parsed', has(r, 'ComfyUI'));

  // ---- Gate 15a: zero byte -------------------------------------------
  console.log('\n[15a] Zero-byte file');
  r = await loadAndInspect(page, FIX('15_zero_byte.bin'));
  check('does not crash', r.status.indexOf('Inspection complete') === 0, r.status);
  check('empty file recorded as a limit, not as clean', limHas(r, 'file-is-zero-bytes'));
  check('SHA-256 of empty input is correct',
    r.card['SHA-256'] === 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', r.card['SHA-256']);
  check('verdict does not claim a clean result', !/no capability limits hit/i.test(r.verdict));

  // ---- Gate 16: label module -----------------------------------------
  console.log('\n[16] Label module');
  await page.selectOption('#f-scope', 'none');
  await page.click('#genlabel');
  await page.waitForTimeout(120);
  let labelHidden = await page.evaluate(() => document.getElementById('labelout').hidden);
  let labelMsg = await page.evaluate(() => document.getElementById('labelstatus').textContent);
  check('scope none produces no annotation block', labelHidden === true);
  check('interface explains the suppression', /does not generate a statement asserting no AI use/.test(labelMsg), labelMsg);

  await page.fill('#f-title', 'Range Week After Action Report');
  await page.fill('#f-docdate', '2026-03-11');
  await page.fill('#f-tool', 'NIPRGPT, build 2026.02');
  await page.selectOption('#f-scope', 'drafting assistance');
  await page.fill('#f-portion', 'paragraphs 3 through 5');
  await page.fill('#f-reviewer', 'GySgt J. A. Rivera');
  await page.fill('#f-revdate', '2026-03-12');
  await page.click('#genlabel');
  await page.waitForTimeout(120);
  let msg2 = await page.evaluate(() => document.getElementById('labelstatus').textContent);
  check('incomplete verification checkbox blocks generation', /Complete these fields first/.test(msg2), msg2);
  await page.check('#f-verify');
  await page.click('#genlabel');
  await page.waitForTimeout(120);
  const labelText = await page.evaluate(() => document.getElementById('labeltext').textContent);
  check('annotation cites paragraph 4.b.(5)', labelText.includes('paragraph 4.b.(5)'));
  check('annotation carries every operator input', labelText.includes('NIPRGPT, build 2026.02') && labelText.includes('paragraphs 3 through 5') && labelText.includes('GySgt J. A. Rivera'));
  check('annotation carries a document date', labelText.includes('2026-03-11'));
  check('annotation has a signature line', /Signature: _+/.test(labelText));
  check('annotation avoids the unsigned "undersigned" wording', !labelText.includes('undersigned'));

  // ---- Gate 17: attestation ------------------------------------------
  console.log('\n[17] Attestation');
  await page.fill('#f-operator', 'Sgt M. T. Alvarez');
  await page.click('#genattest');
  await page.waitForTimeout(150);
  const att = await page.evaluate(() => document.getElementById('attesttext').textContent);
  const sha = await page.evaluate(() => document.getElementById('filecard').children[9].textContent);
  check('mandatory disclaimer present', att.includes('does not validate') && att.includes('Absence of findings is not evidence of absence of AI involvement.'));
  check('unread-is-not-absent line present', att.includes('which is not the same as data being absent from the file'));
  check('operator self-assertion caveat present', att.includes('self-asserted and unverified'));
  check('attestation carries the correct SHA-256', att.includes(sha), sha);
  check('attestation attaches the annotation', att.includes('GENERATIVE AI USE ANNOTATION: attached'));
  check('timestamp carries an explicit offset and Zulu', /Inspection timestamp: .*[+-]\d\d:\d\d \(.*Z\)/.test(att));
  check('capability limits section present', /CAPABILITY LIMITS ENCOUNTERED: \d+/.test(att));

  // ---- Gate 5 replacement: read-only self check -----------------------
  console.log('\n[5] Read-only verification');
  r = await loadAndInspect(page, FIX('10_docx_author_tracked.docx'));
  check('buffer digest unchanged across the parse', has(r, 'digest unchanged across the parse'));
  check('no read-only violation recorded', !limHas(r, 'READ-ONLY VIOLATION'));

  // ---- Gate 16b: textual ---------------------------------------------
  console.log('\n[G-1] Textual inspection');
  r = await loadAndInspect(page, FIX('16_plain_text_invisibles.md'));
  check('zero width space detected', has(r, 'U+200B'), JSON.stringify(r.rows.map(x => x.field)));
  check('word joiner detected', has(r, 'U+2060'));
  check('zero width joiner detected', has(r, 'U+200D'));
  check('records the no-container limit', limHas(r, 'plain-text-carries-no-structured-metadata-container'));
  r = await loadAndInspect(page, FIX('16b_plain_text_clean.txt'));
  check('clean text reports no invisible characters', !has(r, 'invisible character'));

  // ---- Auto-derivation --------------------------------------------------
  console.log('\n[D] Automatic field derivation');
  r = await loadAndInspect(page, FIX('10_docx_author_tracked.docx'));
  let d = await page.evaluate(() => ({
    title: document.getElementById('f-title').value,
    titleOrigin: document.getElementById('o-title').textContent,
    docdate: document.getElementById('f-docdate').value,
    docdateOrigin: document.getElementById('o-docdate').textContent,
    revdate: document.getElementById('f-revdate').value,
    revdateOrigin: document.getElementById('o-revdate').textContent,
    tool: document.getElementById('f-tool').value,
    toolOrigin: document.getElementById('o-tool').textContent,
    toolCandidates: [...document.querySelectorAll('#toolcandidates option')].map(o => o.value),
    nameCandidates: [...document.querySelectorAll('#namecandidates option')].map(o => o.value),
    reviewer: document.getElementById('f-reviewer').value,
    operator: document.getElementById('f-operator').value,
    scope: document.getElementById('f-scope').value,
    verify: document.getElementById('f-verify').checked,
    summary: document.getElementById('derivesummary').textContent,
    count: document.getElementById('derivedcount').textContent
  }));
  check('title auto-filled from dc:title', d.title === 'Range Week After Action Report', d.title);
  check('title names its source', /docProps\/core\.xml/.test(d.titleOrigin), d.titleOrigin);
  check('document date auto-filled from dcterms:modified', d.docdate === '2026-03-11', d.docdate);
  check('document date names its source', /docProps\/core\.xml/.test(d.docdateOrigin), d.docdateOrigin);
  check('review date defaults to today', d.revdate === new Date().toISOString().slice(0, 10), d.revdate);
  check('review date is labeled a default, not a derivation', /default, not a value read from the file/.test(d.revdateOrigin));
  check('tool NOT prefilled without an AI signal', d.tool === '', d.tool);
  check('tool offers candidates found in the file', d.toolCandidates.includes('Microsoft Office Word'), JSON.stringify(d.toolCandidates));
  check('tool explains why it stayed empty', /records what wrote the file, not what generated its content/.test(d.toolOrigin), d.toolOrigin);
  check('reviewer NOT prefilled', d.reviewer === '');
  check('operator NOT prefilled', d.operator === '');
  check('name candidates offered from authorship findings', d.nameCandidates.includes('Sgt M. T. Alvarez'), JSON.stringify(d.nameCandidates));
  check('scope stays none on load', d.scope === 'none');
  check('verification checkbox stays unchecked on load', d.verify === false);
  check('summary counts derived fields', /3 field\(s\) filled from the file/.test(d.summary), d.summary);
  check('fieldset count rendered', /3 of 4 filled/.test(d.count), d.count);

  console.log('\n[D2] Derivation with an explicit generative declaration');
  r = await loadAndInspect(page, FIX('11_docx_c2pa_part.docx'));
  d = await page.evaluate(() => ({
    tool: document.getElementById('f-tool').value,
    toolOrigin: document.getElementById('o-tool').textContent,
    scope: document.getElementById('f-scope').value
  }));
  check('tool auto-filled when the file declares a generator alongside an AI signal', d.tool === 'NIPRGPT', d.tool);
  check('tool origin cites the custom property and the AI signal', /custom\.xml/.test(d.toolOrigin) && /generative source type/.test(d.toolOrigin), d.toolOrigin);
  check('scope still never auto-set, even with an AI signal present', d.scope === 'none');

  console.log('\n[D3] Override tracking and field provenance in the attestation');
  await page.fill('#f-title', 'Corrected Title');
  await page.waitForTimeout(60);
  let ov = await page.evaluate(() => ({
    note: document.getElementById('o-title').textContent,
    cls: document.getElementById('o-title').className,
    summary: document.getElementById('derivesummary').textContent
  }));
  check('override flips the source note to operator entered', /Operator entered, overriding/.test(ov.note), ov.note);
  check('override is visually distinguished', /edited/.test(ov.cls));
  check('summary counts the override', /1 overridden by you/.test(ov.summary), ov.summary);

  await page.selectOption('#f-scope', 'drafting assistance');
  await page.fill('#f-portion', 'paragraphs 3 through 5');
  await page.fill('#f-reviewer', 'GySgt J. A. Rivera');
  await page.fill('#f-operator', 'Sgt M. T. Alvarez');
  await page.check('#f-verify');
  await page.click('#genlabel');
  await page.waitForTimeout(120);
  await page.click('#genattest');
  await page.waitForTimeout(150);
  const att2 = await page.evaluate(() => document.getElementById('attesttext').textContent);
  check('attestation carries a field provenance block', /ANNOTATION FIELD PROVENANCE/.test(att2));
  check('overridden field recorded as an override', /Document title: operator entered, overriding a derived value/.test(att2));
  check('derived field records its source part', /Document date: read from docProps\/core\.xml/.test(att2), (att2.match(/Document date: .*/) || [''])[0]);
  check('review date recorded as a tool default', /Review date: tool default, not read from the file/.test(att2));
  check('tool recorded as read from the custom property', /GenAI tool: read from docProps\/custom\.xml/.test(att2), (att2.match(/GenAI tool: .*/) || [''])[0]);
  check('non-derivable fields recorded as such', /Contribution scope: operator entered, not derivable by this tool/.test(att2));
  check('confirmation recorded as an unverifiable human act', /Accuracy confirmation: operator checkbox, a human act this tool cannot verify/.test(att2));
  check('operator name carried into the attestation from module 2', /Operator: Sgt M\. T\. Alvarez/.test(att2));

  console.log('\n[D4] Derivation fallbacks when the file declares nothing');
  r = await loadAndInspect(page, FIX('16b_plain_text_clean.txt'));
  d = await page.evaluate(() => ({
    title: document.getElementById('f-title').value,
    titleOrigin: document.getElementById('o-title').textContent,
    docdateOrigin: document.getElementById('o-docdate').textContent,
    toolOrigin: document.getElementById('o-tool').textContent
  }));
  check('title falls back to the file name', d.title === '16b_plain_text_clean', d.title);
  check('file-name fallback is flagged as operator supplied and untrusted', /operator supplied and untrusted/.test(d.titleOrigin), d.titleOrigin);
  check('date falls back to the file system with a warning', /file system modification time, which changes on copy/.test(d.docdateOrigin), d.docdateOrigin);
  check('tool stays empty with no candidates', /No software or generator name found/.test(d.toolOrigin), d.toolOrigin);

  // ---- Gate 4: storage ------------------------------------------------
  console.log('\n[4] Storage panel');
  const storage = await page.evaluate(async () => {
    const out = { local: -1, session: -1, cookies: '', idb: -1 };
    try { out.local = localStorage.length; } catch (e) { out.local = 'blocked'; }
    try { out.session = sessionStorage.length; } catch (e) { out.session = 'blocked'; }
    try { out.cookies = document.cookie; } catch (e) { out.cookies = 'blocked'; }
    try { out.idb = (await indexedDB.databases()).length; } catch (e) { out.idb = 'n/a'; }
    return out;
  });
  check('localStorage empty', storage.local === 0 || storage.local === 'blocked', JSON.stringify(storage));
  check('sessionStorage empty', storage.session === 0 || storage.session === 'blocked');
  check('no cookies', storage.cookies === '' || storage.cookies === 'blocked');
  check('no IndexedDB databases', storage.idb === 0 || storage.idb === 'n/a');

  // ---- Gate 15b: 200 MB ------------------------------------------------
  console.log('\n[15b] 200 MB file');
  const t0 = Date.now();
  r = await loadAndInspect(page, FIX('17_large_200mb.bin'));
  const dt = Date.now() - t0;
  check('200 MB file does not crash the page', r.status.indexOf('Inspection complete') === 0, r.status);
  check('200 MB inspection completes under 120 s', dt < 120000, dt + ' ms');
  check('unsupported format recorded as a limit', limHas(r, 'format-unsupported-in-v1') || limHas(r, 'text-scan-limited'), JSON.stringify(r.limits));
  console.log('        elapsed ' + dt + ' ms, size ' + r.card['Size']);

  // ---- Gate 3: network -------------------------------------------------
  console.log('\n[3] Network');
  const external = requests.filter(u => !u.startsWith('file://') && !u.startsWith('data:') && !u.startsWith('blob:') && !u.startsWith('about:'));
  check('zero non-local requests across every inspection', external.length === 0, JSON.stringify(external.slice(0, 5)));
  console.log('        total requests observed: ' + requests.length + ' (all file:// page loads)');

  // ---- Runtime errors ---------------------------------------------------
  console.log('\n[JS] Runtime');
  check('no uncaught page errors', consoleErrors.length === 0, JSON.stringify(consoleErrors.slice(0, 3)));

  await browser.close();
  console.log('\n================ RESULT ================');
  console.log('passed: ' + pass + '   failed: ' + fail);
  if (failures.length) { console.log('\nFailures:'); failures.forEach(f => console.log('  - ' + f)); }
  process.exit(fail ? 1 : 0);
})();
