import { NextResponse, type NextRequest } from 'next/server';

import { saveAttachment } from '@/lib/server/save-attachment';

/**
 * Customer-side message attachment upload.
 *
 * Under /customer/ specifically so middleware's customer-session gate
 * catches it — the staff equivalent at /api/messages/attachments would
 * reject a customer's cookie outright, and this path would fail the same
 * way for a staff cookie. Same validation either way; see
 * lib/server/save-attachment.ts.
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
