import { getDocumentProxy, extractText } from 'unpdf';
import * as mammoth from 'mammoth';
import { requireAuth } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const maxDuration = 60;

const PDF_MIME = 'application/pdf';
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

function chunkText(text: string, size = 800, overlap = 100): string[] {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return [];
  const chunks: string[] = [];
  let start = 0;
  while (start < cleaned.length) {
    const end = Math.min(start + size, cleaned.length);
    chunks.push(cleaned.slice(start, end));
    if (end === cleaned.length) break;
    start = end - overlap;
  }
  return chunks;
}

export async function POST(request: Request) {
  const auth = requireAuth(request);
  if (!auth) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const documentId = typeof body?.documentId === 'string' ? body.documentId : null;
  if (!documentId) {
    return Response.json({ error: 'documentId is required' }, { status: 400 });
  }

  const admin = getSupabaseAdmin();

  const { data: doc, error: fetchError } = await admin
    .from('documents')
    .select('*')
    .eq('id', documentId)
    .eq('user_id', auth.userId)
    .single();

  if (fetchError || !doc) {
    return Response.json({ error: 'Document not found' }, { status: 404 });
  }

  const { data: fileBlob, error: downloadError } = await admin.storage
    .from('documents')
    .download(doc.storage_path);

  if (downloadError || !fileBlob) {
    await admin.from('documents').update({ extraction_status: 'failed' }).eq('id', documentId);
    return Response.json({ error: 'Could not download the file from storage' }, { status: 500 });
  }

  let text = '';
  let status: 'ok' | 'failed' | 'unsupported' = 'unsupported';

  try {
    if (doc.mime_type === PDF_MIME) {
      const bytes = new Uint8Array(await fileBlob.arrayBuffer());
      const pdf = await getDocumentProxy(bytes);
      const result = await extractText(pdf, { mergePages: true });
      text = result.text;
      status = 'ok';
    } else if (doc.mime_type === DOCX_MIME) {
      const buffer = Buffer.from(await fileBlob.arrayBuffer());
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
      status = 'ok';
    }
  } catch (err) {
    status = 'failed';
    console.error('Document extraction failed', err);
  }

  const chunks = status === 'ok' ? chunkText(text) : [];

  // Clears any chunks from a previous extraction attempt on this same document.
  await admin.from('document_chunks').delete().eq('document_id', documentId);

  if (chunks.length) {
    await admin.from('document_chunks').insert(
      chunks.map((content, i) => ({
        user_id: auth.userId,
        document_id: documentId,
        chunk_index: i,
        content,
      }))
    );
  }

  await admin
    .from('documents')
    .update({ extracted_text: text, extraction_status: status })
    .eq('id', documentId);

  return Response.json({ status, chunkCount: chunks.length });
}
