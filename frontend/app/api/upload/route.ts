import { NextResponse, type NextRequest } from 'next/server';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Get the extension
    const originalName = file.name;
    const ext = originalName.split('.').pop()?.toLowerCase() || 'png';
    const filename = `${randomUUID()}.${ext}`;

    const uploadDir = join(process.cwd(), 'public', 'uploads');
    const path = join(uploadDir, filename);

    // In dev, next app usually starts in project root so this writes to /frontend/public/uploads
    // We should make sure the directory exists (fs/promises.mkdir) but for now let's try writing.
    // However since we don't have a reliable way to mkdir synchronously, we use fs/promises mkdir
    const { mkdir } = await import('fs/promises');
    await mkdir(uploadDir, { recursive: true });

    await writeFile(path, buffer);

    return NextResponse.json({ url: `/uploads/${filename}` });
  } catch (error) {
    console.error('Error uploading file:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
