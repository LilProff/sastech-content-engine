import { Document, Paragraph, TextRun, HeadingLevel, Packer } from 'docx';
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import type { Profile } from './types';

// Pure document builders — no Supabase, no secrets, safe to import and unit-test
// anywhere. The orchestration that touches Supabase lives in cvBuilder.ts instead.

// ══════════════════════════════════════════════════════════════════
// DOCX — docx's Paragraph/TextRun model already flows and paginates,
// so this is mostly declarative content, no manual layout needed.
// ══════════════════════════════════════════════════════════════════

function heading(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 100 },
    children: [new TextRun({ text, bold: true, size: 24 })],
  });
}

function line(text: string, opts: { size?: number; bold?: boolean; italics?: boolean; color?: string } = {}) {
  return new Paragraph({
    spacing: { after: 60 },
    children: [new TextRun({ text, size: opts.size ?? 21, bold: opts.bold, italics: opts.italics, color: opts.color })],
  });
}

function bullet(text: string) {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 20 },
    children: [new TextRun({ text, size: 21 })],
  });
}

export async function buildCvDocx(profile: Profile): Promise<Buffer> {
  const children: Paragraph[] = [];

  children.push(
    new Paragraph({
      spacing: { after: 40 },
      children: [new TextRun({ text: profile.full_name || 'Your Name', bold: true, size: 34 })],
    })
  );
  if (profile.headline) children.push(line(profile.headline, { size: 24, color: '555555' }));

  const contact = [profile.email, profile.phone, profile.location, profile.website, profile.linkedin_url, profile.github_url]
    .filter(Boolean)
    .join('   ·   ');
  if (contact) children.push(line(contact, { size: 19, color: '777777' }));

  if (profile.summary) {
    children.push(heading('Summary'));
    children.push(line(profile.summary));
  }

  if (profile.work_history.length) {
    children.push(heading('Work History'));
    for (const job of profile.work_history) {
      children.push(line(`${job.title || 'Role'} — ${job.company || 'Company'}`, { bold: true, size: 22 }));
      const dates = [job.start_date, job.current ? 'Present' : job.end_date].filter(Boolean).join(' – ');
      if (dates) children.push(line(dates, { italics: true, size: 19, color: '777777' }));
      if (job.description) children.push(line(job.description));
      for (const achievement of job.achievements.filter(Boolean)) children.push(bullet(achievement));
      children.push(new Paragraph({ spacing: { after: 120 }, children: [] }));
    }
  }

  if (profile.education.length) {
    children.push(heading('Education'));
    for (const edu of profile.education) {
      const title = [edu.degree || 'Degree', edu.field].filter(Boolean).join(', ');
      children.push(line(`${title} — ${edu.school || 'School'}`, { bold: true, size: 22 }));
      const meta = [
        [edu.start_date, edu.end_date].filter(Boolean).join(' – '),
        edu.gpa && `GPA: ${edu.gpa}`,
      ]
        .filter(Boolean)
        .join('   ·   ');
      if (meta) children.push(line(meta, { italics: true, size: 19, color: '777777' }));
      if (edu.notes) children.push(line(edu.notes));
    }
  }

  if (profile.skills.length) {
    children.push(heading('Skills'));
    children.push(line(profile.skills.map((s) => s.name).filter(Boolean).join('   ·   ')));
  }

  if (profile.certifications.length) {
    children.push(heading('Certifications'));
    for (const cert of profile.certifications) {
      const text = [cert.name, cert.issuer && `— ${cert.issuer}`, cert.date && `(${cert.date})`]
        .filter(Boolean)
        .join(' ');
      children.push(line(text));
    }
  }

  if (profile.languages.length) {
    children.push(heading('Languages'));
    children.push(line(profile.languages.join('   ·   ')));
  }

  const doc = new Document({ sections: [{ children }] });
  return Packer.toBuffer(doc);
}

// ══════════════════════════════════════════════════════════════════
// PDF — pdf-lib has no flow layout, so this hand-rolls wrapping and
// page breaks. Conservative black/gray palette on purpose: resumes
// get printed and scanned by ATS software, not rendered on a phone.
// ══════════════════════════════════════════════════════════════════

const PAGE_WIDTH = 612; // US Letter, points
const PAGE_HEIGHT = 792;
const MARGIN = 54;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const INK = rgb(0.1, 0.1, 0.1);
const MUTED = rgb(0.45, 0.45, 0.45);
const RULE = rgb(0.82, 0.82, 0.82);

class PdfCursor {
  doc: PDFDocument;
  page: PDFPage;
  y: number;
  font: PDFFont;
  fontBold: PDFFont;
  fontItalic: PDFFont;

  constructor(doc: PDFDocument, font: PDFFont, fontBold: PDFFont, fontItalic: PDFFont) {
    this.doc = doc;
    this.font = font;
    this.fontBold = fontBold;
    this.fontItalic = fontItalic;
    this.page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.y = PAGE_HEIGHT - MARGIN;
  }

  private ensureSpace(height: number) {
    if (this.y - height < MARGIN) {
      this.page = this.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      this.y = PAGE_HEIGHT - MARGIN;
    }
  }

  private wrap(text: string, size: number, font: PDFFont, maxWidth: number): string[] {
    const words = text.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let current = '';
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = candidate;
      }
    }
    if (current) lines.push(current);
    return lines;
  }

  text(
    value: string,
    opts: { size?: number; font?: PDFFont; color?: ReturnType<typeof rgb>; indent?: number; gap?: number } = {}
  ) {
    if (!value) return;
    const size = opts.size ?? 10.5;
    const font = opts.font ?? this.font;
    const indent = opts.indent ?? 0;
    const gap = opts.gap ?? size * 0.4;
    const lines = this.wrap(value, size, font, CONTENT_WIDTH - indent);
    for (const l of lines) {
      this.ensureSpace(size + gap);
      this.page.drawText(l, { x: MARGIN + indent, y: this.y - size, size, font, color: opts.color ?? INK });
      this.y -= size + gap;
    }
  }

  bullet(value: string) {
    if (!value) return;
    const size = 10.5;
    const indent = 14;
    const lines = this.wrap(value, size, this.font, CONTENT_WIDTH - indent);
    lines.forEach((l, i) => {
      this.ensureSpace(size + 4);
      if (i === 0) {
        this.page.drawText('•', { x: MARGIN, y: this.y - size, size, font: this.font, color: INK });
      }
      this.page.drawText(l, { x: MARGIN + indent, y: this.y - size, size, font: this.font, color: INK });
      this.y -= size + 4;
    });
  }

  space(height: number) {
    this.y -= height;
  }

  sectionHeading(title: string) {
    this.ensureSpace(30);
    this.space(8);
    this.text(title.toUpperCase(), { size: 11, font: this.fontBold, color: MUTED, gap: 4 });
    this.ensureSpace(8);
    this.page.drawLine({
      start: { x: MARGIN, y: this.y },
      end: { x: PAGE_WIDTH - MARGIN, y: this.y },
      thickness: 0.75,
      color: RULE,
    });
    this.space(10);
  }
}

export async function buildCvPdf(profile: Profile): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
  const c = new PdfCursor(pdfDoc, font, fontBold, fontItalic);

  c.text(profile.full_name || 'Your Name', { size: 20, font: fontBold, gap: 6 });
  if (profile.headline) c.text(profile.headline, { size: 12, color: MUTED, gap: 6 });

  const contact = [profile.email, profile.phone, profile.location, profile.website, profile.linkedin_url, profile.github_url]
    .filter(Boolean)
    .join('   ·   ');
  if (contact) c.text(contact, { size: 9.5, color: MUTED, gap: 10 });

  if (profile.summary) {
    c.sectionHeading('Summary');
    c.text(profile.summary, { gap: 10 });
  }

  if (profile.work_history.length) {
    c.sectionHeading('Work History');
    for (const job of profile.work_history) {
      c.text(`${job.title || 'Role'} — ${job.company || 'Company'}`, { size: 11, font: fontBold, gap: 3 });
      const dates = [job.start_date, job.current ? 'Present' : job.end_date].filter(Boolean).join(' – ');
      if (dates) c.text(dates, { size: 9.5, font: fontItalic, color: MUTED, gap: 4 });
      if (job.description) c.text(job.description, { gap: 3 });
      for (const achievement of job.achievements.filter(Boolean)) c.bullet(achievement);
      c.space(8);
    }
  }

  if (profile.education.length) {
    c.sectionHeading('Education');
    for (const edu of profile.education) {
      const title = [edu.degree || 'Degree', edu.field].filter(Boolean).join(', ');
      c.text(`${title} — ${edu.school || 'School'}`, { size: 11, font: fontBold, gap: 3 });
      const meta = [[edu.start_date, edu.end_date].filter(Boolean).join(' – '), edu.gpa && `GPA: ${edu.gpa}`]
        .filter(Boolean)
        .join('   ·   ');
      if (meta) c.text(meta, { size: 9.5, font: fontItalic, color: MUTED, gap: 4 });
      if (edu.notes) c.text(edu.notes, { gap: 3 });
      c.space(6);
    }
  }

  if (profile.skills.length) {
    c.sectionHeading('Skills');
    c.text(profile.skills.map((s) => s.name).filter(Boolean).join('   ·   '), { gap: 10 });
  }

  if (profile.certifications.length) {
    c.sectionHeading('Certifications');
    for (const cert of profile.certifications) {
      const t = [cert.name, cert.issuer && `— ${cert.issuer}`, cert.date && `(${cert.date})`]
        .filter(Boolean)
        .join(' ');
      c.text(t, { gap: 4 });
    }
  }

  if (profile.languages.length) {
    c.sectionHeading('Languages');
    c.text(profile.languages.join('   ·   '), { gap: 4 });
  }

  return pdfDoc.save();
}
