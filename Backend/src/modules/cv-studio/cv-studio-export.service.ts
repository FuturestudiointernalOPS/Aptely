import PDFDocument from "pdfkit";
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";
import { diffWords } from "diff";
import { supabaseAdmin } from "@/config/supabase";
import { STORAGE_BUCKETS } from "@/services/storage.service";

interface CorrectedSection {
  section_name: string;
  original_text: string;
  corrected_text: string;
  changes: Array<{
    type: string;
    original: string;
    replacement: string;
    reason: string;
  }>;
}

interface CorrectionResult {
  corrected_sections: CorrectedSection[];
  full_corrected_text: string;
  summary: {
    total_changes: number;
    by_type: Record<string, number>;
  };
}

interface DiffPart {
  added?: boolean;
  removed?: boolean;
  value: string;
}

export function computeDiff(original: string, corrected: string): DiffPart[] {
  return diffWords(original, corrected);
}

export async function generateCorrectedPdf(
  analysisId: string,
  userId: string,
  correctionData: CorrectionResult
): Promise<string> {
  const doc = new PDFDocument({ margin: 50, size: "A4" });
  const chunks: Buffer[] = [];

  doc.on("data", (chunk: Buffer) => chunks.push(chunk));

  doc.fontSize(18).font("Helvetica-Bold").text("CV Optimisé", { align: "center" });
  doc.moveDown(0.5);
  doc.fontSize(8).font("Helvetica").fillColor("#888888")
    .text("Généré par Aptely CV Studio — Suggestions IA, relisez toujours avant d'envoyer", { align: "center" });
  doc.moveDown(1);
  doc.fillColor("#000000");

  const sectionTitles: Record<string, string> = {
    summary: "Résumé professionnel",
    experience: "Expérience professionnelle",
    education: "Formation",
    skills: "Compétences",
    languages: "Langues",
    certifications: "Certifications",
    projects: "Projets",
    links: "Liens",
    references: "Références",
    other: "Autre",
  };

  for (const section of correctionData.corrected_sections) {
    const title = sectionTitles[section.section_name] ?? section.section_name;
    doc.fontSize(13).font("Helvetica-Bold").text(title);
    doc.moveDown(0.3);
    doc.fontSize(10).font("Helvetica").text(section.corrected_text, { lineGap: 2 });
    doc.moveDown(0.8);
  }

  await new Promise<void>((resolve) => {
    doc.on("end", resolve);
    doc.end();
  });

  const pdfBuffer = Buffer.concat(chunks);
  const storagePath = `cv-studio/${userId}/exports/${analysisId}-corrected.pdf`;

  const { error: uploadErr } = await supabaseAdmin.storage
    .from(STORAGE_BUCKETS.CV_STUDIO_FILES)
    .upload(storagePath, pdfBuffer, { contentType: "application/pdf", upsert: true });
  if (uploadErr) throw new Error(`PDF upload failed: ${uploadErr.message}`);

  const { error: insertErr } = await supabaseAdmin.from("cv_studio_exports").insert({
    analysis_id: analysisId,
    export_type: "pdf",
    storage_path: storagePath,
    corrected_text: correctionData.full_corrected_text,
    corrections_json: correctionData.summary,
  });
  if (insertErr) throw new Error(`Export record insert failed: ${insertErr.message}`);

  const { data: signedUrl, error: signErr } = await supabaseAdmin.storage
    .from(STORAGE_BUCKETS.CV_STUDIO_FILES)
    .createSignedUrl(storagePath, 3600);
  if (signErr || !signedUrl?.signedUrl) throw new Error(`Signed URL failed: ${signErr?.message}`);

  return signedUrl.signedUrl;
}

export async function generateCorrectedDocx(
  analysisId: string,
  userId: string,
  correctionData: CorrectionResult
): Promise<string> {
  const sectionTitles: Record<string, string> = {
    summary: "Résumé professionnel",
    experience: "Expérience professionnelle",
    education: "Formation",
    skills: "Compétences",
    languages: "Langues",
    certifications: "Certifications",
    projects: "Projets",
    links: "Liens",
    references: "Références",
    other: "Autre",
  };

  const children: Paragraph[] = [
    new Paragraph({
      text: "CV Optimisé",
      heading: HeadingLevel.TITLE,
      spacing: { after: 200 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: "Généré par Aptely CV Studio — Suggestions IA, relisez toujours avant d'envoyer",
          size: 16,
          color: "888888",
          italics: true,
        }),
      ],
      spacing: { after: 400 },
    }),
  ];

  for (const section of correctionData.corrected_sections) {
    const title = sectionTitles[section.section_name] ?? section.section_name;
    children.push(
      new Paragraph({
        text: title,
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 300, after: 100 },
      })
    );

    const lines = section.corrected_text.split("\n");
    for (const line of lines) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: line, size: 22 })],
          spacing: { after: 60 },
        })
      );
    }
  }

  const doc = new Document({
    sections: [{ children }],
  });

  const docxBuffer = await Packer.toBuffer(doc);
  const storagePath = `cv-studio/${userId}/exports/${analysisId}-corrected.docx`;

  const { error: uploadErr } = await supabaseAdmin.storage
    .from(STORAGE_BUCKETS.CV_STUDIO_FILES)
    .upload(storagePath, docxBuffer, {
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      upsert: true,
    });
  if (uploadErr) throw new Error(`DOCX upload failed: ${uploadErr.message}`);

  const { error: insertErr } = await supabaseAdmin.from("cv_studio_exports").insert({
    analysis_id: analysisId,
    export_type: "docx",
    storage_path: storagePath,
    corrected_text: correctionData.full_corrected_text,
    corrections_json: correctionData.summary,
  });
  if (insertErr) throw new Error(`Export record insert failed: ${insertErr.message}`);

  const { data: signedUrl, error: signErr } = await supabaseAdmin.storage
    .from(STORAGE_BUCKETS.CV_STUDIO_FILES)
    .createSignedUrl(storagePath, 3600);
  if (signErr || !signedUrl?.signedUrl) throw new Error(`Signed URL failed: ${signErr?.message}`);

  return signedUrl.signedUrl;
}
