import { NextResponse, type NextRequest } from 'next/server';

import { saveAttachment } from '@/lib/server/save-attachment';

/**
 * Staff-side message attachment upload.
 *
 * Reachable only with a staff session — middleware redirects anything else
 * to /login before this handler runs. The customer equivalent lives at
 * /customer/messages/attachments rather than sharing this path, because
 * middleware gates the two realms on different cookies and a shared path
 * would have to belong to one or the other.
 */
export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get('file');

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  const result = await saveAttachment(file);
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: result.status });
  }

  return NextResponse.json(result.attachment);
}
