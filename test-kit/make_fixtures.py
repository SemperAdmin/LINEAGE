#!/usr/bin/env python3
"""Generate acceptance-test fixtures for LINEAGE. Hand-built bytes, no libraries."""
import os, struct, zlib, zipfile, io

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fixtures")
os.makedirs(OUT, exist_ok=True)
def w(name, data):
    p = os.path.join(OUT, name)
    with open(p, "wb") as f:
        f.write(data)
    print("%-34s %d bytes" % (name, len(data)))
    return p

# ---------------------------------------------------------------- TIFF / EXIF
def build_tiff(entries, little=True):
    """entries: list of (tag, type, values_bytes_or_count_tuple). We build ASCII + LONG only."""
    endian = "<" if little else ">"
    header = (b"II" if little else b"MM") + struct.pack(endian + "H", 42) + struct.pack(endian + "I", 8)
    n = len(entries)
    ifd_size = 2 + n * 12 + 4
    data_off = 8 + ifd_size
    ifd = struct.pack(endian + "H", n)
    blobs = b""
    for (tag, typ, payload) in entries:
        if typ == 2:      # ASCII
            val = payload.encode("ascii") + b"\x00"
            count = len(val)
            if count <= 4:
                field = val + b"\x00" * (4 - count)
            else:
                field = struct.pack(endian + "I", data_off + len(blobs))
                blobs += val
                if len(val) % 2: blobs += b"\x00"
        elif typ == 4:    # LONG, single
            count = 1
            field = struct.pack(endian + "I", payload)
        else:
            raise ValueError(typ)
        ifd += struct.pack(endian + "HHI", tag, typ, count) + field
    ifd += struct.pack(endian + "I", 0)
    return header + ifd + blobs

EXIF_ENTRIES = [
    (0x010F, 2, "NIKON CORPORATION"),
    (0x0110, 2, "NIKON Z 6_2"),
    (0x0131, 2, "Ver.01.40"),
    (0x0132, 2, "2026:03:11 14:02:55"),
    (0x013B, 2, "SSgt R. K. Doyle, USMC"),
    (0x8298, 2, "Public Domain, US Government Work"),
    (0x8825, 4, 0x7FFFFF00),   # GPS IFD pointer, presence only
]
TIFF = build_tiff(EXIF_ENTRIES)

# ---------------------------------------------------------------- JPEG
def jpeg_seg(marker, payload):
    return bytes([0xFF, marker]) + struct.pack(">H", len(payload) + 2) + payload

def jpeg(segments, with_restart_markers=False):
    body = b"\xFF\xD8"
    if with_restart_markers:
        body += b"\xFF\xD0\xFF\xD1"          # standalone markers, no length field
        body += b"\xFF\xFF"                  # fill bytes before the next marker
    for s in segments:
        body += s
    body += b"\xFF\xDA" + struct.pack(">H", 12) + b"\x01" * 10   # SOS
    body += b"\x00" * 64
    body += b"\xFF\xD9"
    return body

app1_exif = jpeg_seg(0xE1, b"Exif\x00\x00" + TIFF)
xmp_body = (b"http://ns.adobe.com/xap/1.0/\x00"
            b'<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?>'
            b'<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">'
            b'<rdf:Description xmp:CreatorTool="Adobe Photoshop 26.0" xmp:CreateDate="2026-03-11T14:02:55"'
            b' dc:creator="SSgt R. K. Doyle"/></rdf:RDF></x:xmpmeta><?xpacket end="w"?>')
app1_xmp = jpeg_seg(0xE1, xmp_body)
com = jpeg_seg(0xFE, b"Photo taken during MCBH range week.")

w("06_jpeg_exif_no_c2pa.jpg", jpeg([app1_exif, app1_xmp, com], with_restart_markers=True))

# JPEG carrying a multi-segment C2PA JUMBF manifest declaring generative AI
manifest = (b"\x00\x00\x00\x1ejumd" + b"c2pa" + b"\x00" * 8 +
            b'{"claim_generator":"SomeImageGen/2.4 c2pa-rs/0.33",'
            b'"assertions":[{"label":"stds.schema-org.CreativeWork",'
            b'"data":{"digitalSourceType":"http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia"}}]}')
manifest += b"\x00" * 400   # pad so the split is meaningful
tbox = b"jumb"
lbox = struct.pack(">I", 8 + len(manifest))
full = lbox + tbox + manifest
half = len(full) // 2
seg1 = jpeg_seg(0xEB, b"JP" + struct.pack(">H", 1) + struct.pack(">I", 1) + full[:half])
seg2 = jpeg_seg(0xEB, b"JP" + struct.pack(">H", 1) + struct.pack(">I", 2) + full[half:])
w("07_jpeg_c2pa_genai.jpg", jpeg([app1_exif, seg1, seg2]))

# JPEG with a camera-style C2PA manifest and NO generative source type.
# Correct behavior: provenance finding, aiSignal false.
cam = (b"\x00\x00\x00\x1ejumd" + b"c2pa" + b"\x00" * 8 +
       b'{"claim_generator":"Nikon Z6_2 c2pa-rs/0.33","assertions":[{"label":"c2pa.actions",'
       b'"data":{"actions":[{"action":"c2pa.created","digitalSourceType":'
       b'"http://cv.iptc.org/newscodes/digitalsourcetype/digitalCapture"}]}}]}')
camfull = struct.pack(">I", 8 + len(cam)) + b"jumb" + cam
segc = jpeg_seg(0xEB, b"JP" + struct.pack(">H", 1) + struct.pack(">I", 1) + camfull)
w("07b_jpeg_c2pa_camera_no_ai.jpg", jpeg([app1_exif, segc]))

# ---------------------------------------------------------------- PNG
def png_chunk(ctype, data):
    return struct.pack(">I", len(data)) + ctype + data + struct.pack(">I", zlib.crc32(ctype + data) & 0xFFFFFFFF)

PNG_SIG = b"\x89PNG\r\n\x1a\n"
ihdr = png_chunk(b"IHDR", struct.pack(">IIBBBBB", 4, 4, 8, 2, 0, 0, 0))
idat = png_chunk(b"IDAT", zlib.compress(b"\x00" + b"\xff" * 12 + (b"\x00" + b"\xff" * 12) * 3))
iend = png_chunk(b"IEND", b"")

text_chunks = (
    png_chunk(b"tEXt", b"Software\x00ComfyUI") +
    png_chunk(b"tEXt", b"Author\x00Cpl D. Nguyen") +
    png_chunk(b"tEXt", b"parameters\x00a photograph of a rifle range at dawn, steps: 30, cfg: 7")
)
w("08_png_text_chunks.png", PNG_SIG + ihdr + text_chunks + idat + iend)

ztxt_payload = b"workflow\x00\x00" + zlib.compress(b'{"nodes":[{"class_type":"KSampler","widgets":[30,7.0]}],"generated_by":"ComfyUI"}')
itxt_comp = b"Comment\x00\x01\x00en\x00Comment\x00" + zlib.compress(b"Rendered on workstation MCBH-S1-07.")
w("09_png_ztxt_compressed.png", PNG_SIG + ihdr + png_chunk(b"zTXt", ztxt_payload) + png_chunk(b"iTXt", itxt_comp) + idat + iend)

# PNG with eXIf (TIFF at chunk data offset 0, no Exif\0\0 prefix) and a camera caBX
cabx = (b"\x00\x00\x00\x1ejumd" + b"c2pa" + b"\x00" * 8 +
        b'{"claim_generator":"Leica M11-P c2pa-rs/0.31"}')
w("08b_png_exif_and_cabx.png",
  PNG_SIG + ihdr + png_chunk(b"eXIf", TIFF) + png_chunk(b"caBX", cabx) +
  png_chunk(b"tIME", struct.pack(">HBBBBB", 2026, 3, 11, 14, 2, 55)) + idat + iend)

# Mismatched extension: a PNG named report.pdf
w("14_report.pdf", PNG_SIG + ihdr + text_chunks + idat + iend)

# ---------------------------------------------------------------- DOCX
def build_docx(path, tracked=True, c2pa_part=False):
    buf = io.BytesIO()
    z = zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED)
    z.writestr("[Content_Types].xml",
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        '<Default Extension="xml" ContentType="application/xml"/>'
        '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
        + ('<Override PartName="/word/c2pa.manifest" ContentType="application/x-c2pa-manifest-store"/>' if c2pa_part else '')
        + '</Types>')
    z.writestr("_rels/.rels",
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
        '</Relationships>')
    z.writestr("docProps/core.xml",
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" '
        'xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/">'
        '<dc:title>Range Week After Action Report</dc:title>'
        '<dc:creator>Sgt M. T. Alvarez</dc:creator>'
        '<cp:lastModifiedBy>GySgt J. A. Rivera</cp:lastModifiedBy>'
        '<cp:revision>17</cp:revision>'
        '<dcterms:created>2026-03-02T08:14:00Z</dcterms:created>'
        '<dcterms:modified>2026-03-11T16:41:00Z</dcterms:modified>'
        '<cp:keywords>AAR; range; MCBH</cp:keywords>'
        '<dc:description>Drafted with assistance from a generative tool, reviewed by S-3.</dc:description>'
        '</cp:coreProperties>')
    z.writestr("docProps/app.xml",
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">'
        '<Application>Microsoft Office Word</Application><AppVersion>16.0000</AppVersion>'
        '<Company>MCBH S-1</Company><Manager>Capt L. Ortiz</Manager><TotalTime>412</TotalTime>'
        '<Template>Normal.dotm</Template></Properties>')
    z.writestr("docProps/custom.xml",
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/custom-properties" '
        'xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">'
        '<property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="2" name="GenAI Tool">'
        '<vt:lpwstr>NIPRGPT</vt:lpwstr></property></Properties>')
    doc = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
           '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>')
    if tracked:
        doc += ('<w:p><w:ins w:id="1" w:author="Sgt M. T. Alvarez"><w:r><w:t>Added text.</w:t></w:r></w:ins>'
                '<w:del w:id="2" w:author="GySgt J. A. Rivera"><w:r><w:delText>Removed text.</w:delText></w:r></w:del></w:p>')
    doc += '<w:p><w:r><w:t>Body paragraph.</w:t></w:r></w:p></w:body></w:document>'
    z.writestr("word/document.xml", doc)
    z.writestr("word/settings.xml",
        '<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        '<w:rsids><w:rsid w:val="00A12B34"/><w:rsid w:val="00B45C67"/></w:rsids></w:settings>')
    z.writestr("word/comments.xml",
        '<w:comments xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        '<w:comment w:id="1" w:author="Capt L. Ortiz" w:date="2026-03-05T09:00:00Z"><w:p><w:r><w:t>Verify the count.</w:t></w:r></w:p></w:comment>'
        '<w:comment w:id="2" w:author="1stSgt P. Hale"><w:p><w:r><w:t>Concur.</w:t></w:r></w:p></w:comment>'
        '</w:comments>')
    z.writestr("word/_rels/document.xml.rels",
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId9" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" '
        'Target="https://www.marines.mil/Portals/1/Publications/NAVMC%205239.1.pdf" TargetMode="External"/>'
        '<Relationship Id="rId10" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.png"/>'
        '</Relationships>')
    if c2pa_part:
        z.writestr("word/c2pa.manifest",
            b'\x00\x00\x00\x1ejumdc2pa' + b'\x00' * 8 +
            b'{"claim_generator":"DocGen/1.2","assertions":[{"data":{"digitalSourceType":'
            b'"http://cv.iptc.org/newscodes/digitalsourcetype/compositeWithTrainedAlgorithmicMedia"}}]}')
    z.close()
    w(path, buf.getvalue())

build_docx("10_docx_author_tracked.docx", tracked=True, c2pa_part=False)
build_docx("11_docx_c2pa_part.docx", tracked=True, c2pa_part=True)

# ---------------------------------------------------------------- PDF
def pdf_classic():
    objs = []
    objs.append(b"<< /Type /Catalog /Pages 2 0 R >>")
    objs.append(b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>")
    objs.append(b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>")
    objs.append(b"<< /Title (Range Week After Action Report) /Author (Sgt M. T. Alvarez) "
                b"/Creator (Microsoft\\256 Word for Microsoft 365) "
                b"/Producer (Microsoft\\256 Word for Microsoft 365) "
                b"/CreationDate (D:20260302081400Z) /ModDate (D:20260311164100Z) "
                b"/Subject <FEFF00520061006E00670065> >>")
    out = b"%PDF-1.7\n%\xE2\xE3\xCF\xD3\n"
    offsets = []
    for i, o in enumerate(objs, start=1):
        offsets.append(len(out))
        out += b"%d 0 obj\n" % i + o + b"\nendobj\n"
    xref_at = len(out)
    out += b"xref\n0 %d\n" % (len(objs) + 1)
    out += b"0000000000 65535 f \n"
    for off in offsets:
        out += b"%010d 00000 n \n" % off
    out += b"trailer\n<< /Size %d /Root 1 0 R /Info 4 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (len(objs) + 1, xref_at)
    return out
w("12_pdf_info_dict.pdf", pdf_classic())

def pdf_xref_stream():
    out = b"%PDF-1.7\n%\xE2\xE3\xCF\xD3\n"
    out += b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"
    out += b"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n"
    out += b"3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\n"
    # Info lives inside a compressed object stream, unreachable without inflation of the xref chain
    payload = zlib.compress(b"<< /Title (Compressed Title) /Producer (LaTeX with hyperref) >>")
    out += b"4 0 obj\n<< /Type /ObjStm /N 1 /First 8 /Filter /FlateDecode /Length %d >>\nstream\n" % len(payload)
    out += payload + b"\nendstream\nendobj\n"
    xref_at = len(out)
    xdata = zlib.compress(b"\x01\x00\x00\x0f\x00")
    out += b"5 0 obj\n<< /Type /XRef /Size 6 /W [1 2 1] /Root 1 0 R /Filter /FlateDecode /Length %d >>\nstream\n" % len(xdata)
    out += xdata + b"\nendstream\nendobj\n"
    out += b"startxref\n%d\n%%%%EOF\n" % xref_at
    return out
w("13_pdf_xref_stream.pdf", pdf_xref_stream())

def pdf_encrypted():
    out = b"%PDF-1.7\n"
    out += b"1 0 obj\n<< /Type /Catalog >>\nendobj\n"
    out += b"4 0 obj\n<< /Author <2A9F13C4EE01> /Producer <11BC77> >>\nendobj\n"
    xref_at = len(out)
    out += b"xref\n0 1\n0000000000 65535 f \n"
    out += b"trailer\n<< /Size 5 /Root 1 0 R /Info 4 0 R /Encrypt 6 0 R >>\nstartxref\n%d\n%%%%EOF\n" % xref_at
    return out
w("13b_pdf_encrypted.pdf", pdf_encrypted())

# ---------------------------------------------------------------- text
w("15_zero_byte.bin", b"")
w("16_plain_text_invisibles.md",
  ("# After Action Report\n\nThe range​ detail completed​ fire on 11 March.\n"
   "Ammunition⁠ counts reconciled with the armory.‍\n").encode("utf-8"))
w("16b_plain_text_clean.txt", b"# After Action Report\n\nNothing hidden in this file.\n")

# 200 MB file with a provenance signal near the tail
big = bytearray(b"\x00" * 8)
w("17_large_200mb.bin", b"")   # placeholder, written below by shell for speed
print("fixtures written to", OUT)
