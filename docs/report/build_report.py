"""Build the MeQ thesis .docx from report_content.py.

The page layout, styles, chapter numbering, and page-number headers are taken
from a department thesis template (a previous NU CS thesis .docx). The body is
replaced with the content defined in report_content.py.

Usage:
    python -I build_report.py <template.docx> <output.docx>

Images are read from paths relative to the repository root. A missing image
becomes a highlighted placeholder box, so screenshots can be added later and
the document rebuilt.
"""
import os
import re
import struct
import sys
import zipfile
from xml.sax.saxutils import escape

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
sys.path.insert(0, HERE)
import report_content as C  # noqa: E402

TEXT_WIDTH_TWIPS = 11906 - 2160 - 1440
MAX_IMG_W = TEXT_WIDTH_TWIPS * 635
MAX_IMG_H = 10500 * 635
CELL_RPR = '<w:sz w:val="22"/><w:szCs w:val="22"/>'


# ---------------------------------------------------------------- inline text
THAI_FONT = "TH SarabunPSK"
THAI_TEXT_PT = 16
THAI_HEADING_PT = 18
THAI = re.compile("[฀-๿]")
# A stretch of Thai text, including the spaces and zero-width word breaks between Thai words.
THAI_SPAN = re.compile("([฀-๿​]+(?:[ ​]+[฀-๿​]+)*)")
TOKEN = re.compile(r"(\*\*.+?\*\*|\*[^*\s][^*]*?\*|`[^`]+`|\{\{.+?\}\})")


def runs(text, base_rpr="", thai_pt=THAI_TEXT_PT):
    """Render inline markup: **bold**, *italic*, `code`, {{TODO highlight}}."""
    out = []
    for part in TOKEN.split(text):
        if not part:
            continue
        rpr = base_rpr
        if part.startswith("**"):
            part, rpr = part[2:-2], rpr + "<w:b/><w:bCs/>"
        elif part.startswith("{{"):
            part, rpr = part[2:-2], rpr + '<w:highlight w:val="yellow"/>'
        elif part.startswith("`"):
            part, rpr = part[1:-1], rpr + '<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:cs="Consolas"/><w:sz w:val="22"/>'
        elif part.startswith("*"):
            part, rpr = part[1:-1], rpr + "<w:i/><w:iCs/>"
        # Arial has no Thai glyphs, so Thai stretches get their own runs in TH SarabunPSK; the rest stays Arial.
        # Sarabun is small for its point size: Thai text is 16 pt and Thai in headings 18 pt, as in Thai documents.
        for seg in THAI_SPAN.split(part):
            if not seg:
                continue
            fonts, seg_rpr = '<w:rFonts w:cs="Arial"/>', rpr
            if THAI.search(seg):
                fonts = f'<w:rFonts w:ascii="{THAI_FONT}" w:hAnsi="{THAI_FONT}" w:cs="{THAI_FONT}" w:hint="cs"/>'
                half_points = thai_pt * 2
                size = f'<w:sz w:val="{half_points}"/><w:szCs w:val="{half_points}"/>'
                seg_rpr = re.sub(r'<w:szCs? w:val="\d+"/>', "", rpr)
                if "<w:highlight" in seg_rpr:  # rPr children must stay in schema order: sz before highlight
                    seg_rpr = seg_rpr.replace("<w:highlight", size + "<w:highlight", 1)
                else:
                    seg_rpr += size
                seg_rpr += '<w:lang w:bidi="th-TH"/>'
            if "Consolas" in rpr:
                fonts = ""
            out.append(f'<w:r><w:rPr>{fonts}{seg_rpr}</w:rPr><w:t xml:space="preserve">{escape(seg)}</w:t></w:r>')
    return "".join(out)


def para(style, text, ppr_extra="", rpr=""):
    return f'<w:p><w:pPr><w:pStyle w:val="{style}"/>{ppr_extra}</w:pPr>{runs(text, rpr)}</w:p>'


# ---------------------------------------------------------------- document
class Doc:
    def __init__(self):
        self.parts = []
        self.chapter = 0
        self.fig = 0
        self.tbl = 0
        self.media = []  # (zip name, rId, bytes)
        self.next_num = 300
        self.nums = []  # (numId, abstractId)
        self.doc_pr = 1000
        self.appendix = None

    # headings
    def chapter_heading(self, title):
        self.chapter += 1
        self.fig = self.tbl = 0
        self.appendix = None
        self.parts.append(
            # The template numbers chapters with list 26 (restart) for Chapter 1 and list 3 after it.
            f'<w:p><w:pPr><w:pStyle w:val="Heading1"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="{26 if self.chapter == 1 else 3}"/></w:numPr>'
            '<w:ind w:left="0" w:hanging="0"/></w:pPr><w:r><w:br/></w:r>' + runs(title, thai_pt=THAI_HEADING_PT) + "</w:p>")

    def plain_heading(self, title, appendix=None, new_page=False):
        if appendix:
            self.appendix = appendix
            self.fig = self.tbl = 0
        # pageBreakBefore, unlike a separate page-break paragraph, never leaves a blank page
        # when the previous page is already full.
        brk = "<w:pageBreakBefore/>" if new_page else ""
        self.parts.append(
            f'<w:p><w:pPr><w:pStyle w:val="Heading1"/>{brk}<w:numPr><w:ilvl w:val="0"/><w:numId w:val="0"/></w:numPr>'
            '<w:ind w:left="0" w:hanging="0"/></w:pPr>' + runs(title, thai_pt=THAI_HEADING_PT) + "</w:p>")

    def h(self, level, title, numbered=True):
        style = {2: "Heading2", 3: "Heading3"}[level]
        ilvl = level - 1
        num = (f'<w:keepNext/><w:numPr><w:ilvl w:val="{ilvl}"/><w:numId w:val="3"/></w:numPr><w:ind w:left="0" w:hanging="0"/><w:jc w:val="left"/>'
               if numbered else '<w:keepNext/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="0"/></w:numPr><w:ind w:left="0" w:hanging="0"/>')
        self.parts.append(f'<w:p><w:pPr><w:pStyle w:val="{style}"/>{num}</w:pPr>{runs(title, thai_pt=THAI_HEADING_PT)}</w:p>')

    # text
    def p(self, text):
        self.parts.append(para("Normal", text))

    def pni(self, text):
        self.parts.append(para("NormalNoIndent", text))

    def pleft(self, text):
        """Unindented, left-aligned paragraph (Thai text has no spaces between words to justify on)."""
        self.parts.append(para("NormalNoIndent", text, '<w:jc w:val="left"/>'))

    def lead(self, label, text):
        """Paragraph that starts with a bold label, like 'Client side.'"""
        self.parts.append(para("Normal", f"**{label}** {text}"))

    def ol(self, items, paren=False):
        abstract = "5" if paren else "4"
        num_id = self.next_num
        self.next_num += 1
        self.nums.append((num_id, abstract))
        for item in items:
            self.parts.append(
                f'<w:p><w:pPr><w:pStyle w:val="ListParagraph"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="{num_id}"/></w:numPr></w:pPr>'
                + runs(item) + "</w:p>")

    def page_break(self):
        self.parts.append('<w:p><w:r><w:br w:type="page"/></w:r></w:p>')

    # captions
    def _label(self, kind):
        if kind == "Figure":
            self.fig += 1
            n = self.fig
        else:
            self.tbl += 1
            n = self.tbl
        prefix = self.appendix if self.appendix else str(self.chapter)
        return f"{kind} {prefix}.{n}"

    def caption(self, kind, text):
        label = self._label(kind)
        style = "Caption1" if kind == "Figure" else "TableCaption"
        keep = '<w:keepNext/>' if kind == "Table" else ""
        self.parts.append(
            f'<w:p><w:pPr><w:pStyle w:val="{style}"/>{keep}</w:pPr>'
            f'<w:r><w:rPr><w:rFonts w:cs="Arial"/><w:b/><w:bCs/><w:i w:val="false"/></w:rPr><w:t>{label}</w:t></w:r>'
            + runs(" " + text, '<w:b w:val="false"/>') + "</w:p>")
        return label

    # figures
    def figure(self, path, caption, width_pct=100):
        full = os.path.join(REPO, path)
        if os.path.exists(full):
            data = open(full, "rb").read()
            w, h = png_size(data)
            cx = int(MAX_IMG_W * width_pct / 100)
            cy = int(cx * h / w)
            if cy > MAX_IMG_H:
                cy = MAX_IMG_H
                cx = int(cy * w / h)
            rid = f"rIdMeq{len(self.media) + 1}"
            name = f"media/meq_{len(self.media) + 1}.png"
            self.media.append((name, rid, data))
            self.doc_pr += 1
            dp = self.doc_pr
            drawing = (
                f'<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="{cx}" cy="{cy}"/>'
                f'<wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="{dp}" name="Picture {dp}" descr="{escape(caption)}"/>'
                '<wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr>'
                '<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">'
                f'<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="{dp}" name="Picture {dp}"/><pic:cNvPicPr/></pic:nvPicPr>'
                f'<pic:blipFill><a:blip r:embed="{rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>'
                f'<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="{cx}" cy="{cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic>'
                "</a:graphicData></a:graphic></wp:inline></w:drawing></w:r>")
            self.parts.append(f'<w:p><w:pPr><w:pStyle w:val="Figure"/><w:keepNext/></w:pPr>{drawing}</w:p>')
        else:
            box = ('<w:pBdr><w:top w:val="dashed" w:sz="8" w:space="8" w:color="999999"/><w:left w:val="dashed" w:sz="8" w:space="8" w:color="999999"/>'
                   '<w:bottom w:val="dashed" w:sz="8" w:space="8" w:color="999999"/><w:right w:val="dashed" w:sz="8" w:space="8" w:color="999999"/></w:pBdr>'
                   '<w:shd w:val="clear" w:color="auto" w:fill="FFF7E0"/><w:spacing w:before="600" w:after="600"/>')
            self.parts.append(f'<w:p><w:pPr><w:pStyle w:val="Figure"/><w:keepNext/>{box}</w:pPr>'
                              + runs(f"{{{{[Insert image: {path}]}}}}") + "</w:p>")
        self.caption("Figure", caption)

    # tables
    def table(self, caption, header, rows, widths=None):
        self.caption("Table", caption)
        cols = len(header)
        if widths is None:
            widths = [1] * cols
        total = sum(widths)
        tw = [int(TEXT_WIDTH_TWIPS * w / total) for w in widths]
        tw[-1] = TEXT_WIDTH_TWIPS - sum(tw[:-1])
        border = ('<w:tblBorders><w:top w:val="single" w:sz="8" w:color="000000"/><w:left w:val="nil"/>'
                  '<w:bottom w:val="single" w:sz="8" w:color="000000"/><w:right w:val="nil"/>'
                  '<w:insideH w:val="single" w:sz="4" w:color="BFBFBF"/><w:insideV w:val="nil"/></w:tblBorders>')
        xml = [f'<w:tbl><w:tblPr><w:tblW w:w="{TEXT_WIDTH_TWIPS}" w:type="dxa"/><w:tblLayout w:type="fixed"/>{border}'
               '<w:tblCellMar><w:top w:w="40" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:bottom w:w="40" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tblCellMar>'
               '</w:tblPr><w:tblGrid>' + "".join(f'<w:gridCol w:w="{w}"/>' for w in tw) + "</w:tblGrid>"]

        # Tables may split across pages, but never leave the header or a single row alone:
        # the header keeps with the first row, and the second-to-last row keeps with the last.
        def keeps(i):
            return i == 0 or i == len(rows) - 2

        def row(cells, head, keep=False):
            trpr = '<w:trPr><w:tblHeader/><w:cantSplit/></w:trPr>' if head else '<w:trPr><w:cantSplit/></w:trPr>'
            r = [f"<w:tr>{trpr}"]
            for w, c in zip(tw, cells):
                shade = '<w:shd w:val="clear" w:color="auto" w:fill="F2F2F2"/>' if head else ""
                bottom = '<w:tcBorders><w:bottom w:val="single" w:sz="8" w:color="000000"/></w:tcBorders>' if head else ""
                text = f"**{c}**" if head and c else str(c)
                r.append(f'<w:tc><w:tcPr><w:tcW w:w="{w}" w:type="dxa"/>{bottom}{shade}</w:tcPr>'
                         f'<w:p><w:pPr><w:pStyle w:val="NoSpacing"/>{"<w:keepNext/>" if keep else ""}<w:jc w:val="left"/><w:rPr><w:sz w:val="22"/></w:rPr></w:pPr>{runs(text, CELL_RPR)}</w:p></w:tc>')
            r.append("</w:tr>")
            return "".join(r)

        xml.append(row(header, True, True))
        for i, rr in enumerate(rows):
            xml.append(row(rr, False, keeps(i)))
        xml.append("</w:tbl>")
        self.parts.append("".join(xml))
        self.parts.append('<w:p><w:pPr><w:pStyle w:val="NoSpacing"/></w:pPr></w:p>')

    # front matter helpers
    def info_line(self, label, value):
        self.parts.append(
            '<w:p><w:pPr><w:pStyle w:val="Normal"/><w:tabs><w:tab w:val="clear" w:pos="720"/><w:tab w:val="left" w:pos="2160"/></w:tabs>'
            '<w:spacing w:before="0" w:after="0"/><w:ind w:left="2160" w:hanging="2160"/><w:jc w:val="left"/></w:pPr>'
            f'<w:r><w:rPr><w:rFonts w:cs="Arial"/><w:b/><w:bCs/></w:rPr><w:t>{escape(label)}</w:t></w:r><w:r><w:tab/></w:r>{runs(value)}</w:p>')

    def toc(self, title, instr):
        self.plain_heading(title)
        self.parts.append(
            '<w:p><w:pPr><w:pStyle w:val="NormalNoIndent"/><w:jc w:val="right"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>page</w:t></w:r></w:p>'
            '<w:p><w:pPr><w:pStyle w:val="NormalNoIndent"/></w:pPr>'
            f'<w:r><w:fldChar w:fldCharType="begin" w:dirty="true"/></w:r><w:r><w:instrText xml:space="preserve"> {instr} </w:instrText></w:r>'
            '<w:r><w:fldChar w:fldCharType="separate"/></w:r>'
            '<w:r><w:rPr><w:highlight w:val="yellow"/></w:rPr><w:t>Right-click here and choose Update Field (or press Ctrl+A then F9) to build this list.</w:t></w:r>'
            '<w:r><w:fldChar w:fldCharType="end"/></w:r></w:p>')

    def reference(self, n, text):
        self.parts.append(
            '<w:p><w:pPr><w:pStyle w:val="References"/><w:spacing w:before="0" w:after="120"/></w:pPr>'
            f'<w:r><w:rPr><w:rFonts w:cs="Arial"/></w:rPr><w:t>[{n}]</w:t></w:r><w:r><w:tab/></w:r>{runs(text)}</w:p>')

    def raw(self, xml):
        self.parts.append(xml)

    def section_break(self, sect_ppr):
        """End the current section using one of the template's sectPr blocks."""
        self.parts.append(f"<w:p><w:pPr>{sect_ppr}</w:pPr></w:p>")


def png_size(data):
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError("only PNG images are supported")
    return struct.unpack(">II", data[16:24])


# ---------------------------------------------------------------- template
def build(template, output):
    zin = zipfile.ZipFile(template)
    names = zin.namelist()
    document = zin.read("word/document.xml").decode("utf-8")
    body_start = document.index("<w:body>") + len("<w:body>")
    body_end = document.index("</w:body>")
    head, body, tail = document[:body_start], document[body_start:body_end], document[body_end:]

    sect_blocks = re.findall(r"<w:sectPr\b.*?</w:sectPr>", body, re.S)
    if len(sect_blocks) != 8:
        raise SystemExit(f"expected 8 sections in the template, found {len(sect_blocks)}")

    # Cover and committee pages: the template's first section with names replaced.
    cover_end = body.index("</w:sectPr>") + len("</w:sectPr>")
    cover_end = body.index("</w:p>", cover_end) + len("</w:p>")
    cover = body[:cover_end]
    for old, new in C.COVER_REPLACEMENTS:
        if old not in cover:
            raise SystemExit(f"cover text not found in template: {old!r}")
        cover = cover.replace(old, escape(new))

    doc = Doc()
    C.write(doc, sect_blocks)

    new_body = cover + "".join(doc.parts)
    final_sect = sect_blocks[-1]
    new_document = head + new_body + final_sect + tail

    rels = zin.read("word/_rels/document.xml.rels").decode("utf-8")
    image_targets = set(re.findall(r'Target="(media/[^"]+)"', rels))
    rels = re.sub(r'<Relationship [^>]*Type="[^"]+/image"[^>]*/>', "", rels)
    rels = rels.replace("</Relationships>", "".join(
        f'<Relationship Id="{rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="{name}"/>'
        for name, rid, _ in doc.media) + "</Relationships>")

    numbering = zin.read("word/numbering.xml").decode("utf-8")
    numbering = numbering.replace("</w:numbering>", "".join(
        f'<w:num w:numId="{nid}"><w:abstractNumId w:val="{aid}"/><w:lvlOverride w:ilvl="0"><w:startOverride w:val="1"/></w:lvlOverride></w:num>'
        for nid, aid in doc.nums) + "</w:numbering>")

    styles = zin.read("word/styles.xml").decode("utf-8")
    if 'w:styleId="TableCaption"' not in styles:
        styles = styles.replace("</w:styles>",
            '<w:style w:type="paragraph" w:customStyle="1" w:styleId="TableCaption"><w:name w:val="Table Caption"/>'
            '<w:basedOn w:val="Caption1"/><w:qFormat/><w:pPr><w:keepNext/><w:jc w:val="left"/></w:pPr></w:style></w:styles>')

    # The template's complex-script fonts come from the theme (Cordia New, Angsana New), which overrides the
    # font set on Thai runs. Use the Thai font directly instead.
    styles = re.sub(r'w:cs="(?:Cordia New|Angsana New)"( w:asciiTheme="minorHAnsi")? w:cstheme="(?:minor|major)Bidi"',
                    rf'w:cs="{THAI_FONT}"\1', styles)

    settings = zin.read("word/settings.xml").decode("utf-8")
    if "w:updateFields" not in settings:
        settings = re.sub(r"(<w:settings\b[^>]*>)", r'\1<w:updateFields w:val="true"/>', settings, count=1)

    content_types = zin.read("[Content_Types].xml").decode("utf-8")
    if 'Extension="png"' not in content_types:
        content_types = content_types.replace("<Types ", "<Types ", 1).replace(
            "</Types>", '<Default Extension="png" ContentType="image/png"/></Types>')

    zout = zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED)
    for name in names:
        if name.startswith("word/") and name[5:] in image_targets:
            continue  # drop the template's own images
        if name == "word/document.xml":
            zout.writestr(name, new_document)
        elif name == "word/_rels/document.xml.rels":
            zout.writestr(name, rels)
        elif name == "word/numbering.xml":
            zout.writestr(name, numbering)
        elif name == "word/styles.xml":
            zout.writestr(name, styles)
        elif name == "word/settings.xml":
            zout.writestr(name, settings)
        elif name == "[Content_Types].xml":
            zout.writestr(name, content_types)
        elif name in ("docProps/core.xml", "docProps/custom.xml"):
            data = zin.read(name).decode("utf-8")
            data = re.sub(r"<dc:title>.*?</dc:title>", f"<dc:title>{escape(C.TITLE)}</dc:title>", data)
            data = re.sub(r"<dc:creator>.*?</dc:creator>", f"<dc:creator>{escape(C.AUTHOR)}</dc:creator>", data)
            zout.writestr(name, data)
        else:
            zout.writestr(name, zin.read(name))
    for name, _, data in doc.media:
        zout.writestr("word/" + name, data)
    zout.close()
    missing = [p for p in C.ALL_FIGURES if not os.path.exists(os.path.join(REPO, p))]
    print(f"wrote {output}: chapters={doc.chapter} images={len(doc.media)} placeholders={len(missing)}")
    for p in missing:
        print("  missing:", p)


if __name__ == "__main__":
    build(sys.argv[1], sys.argv[2])
