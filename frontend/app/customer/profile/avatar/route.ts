import { randomUUID } from 'crypto';
import { NextResponse, type NextRequest } from 'next/server';

import { customerMutate } from '@/lib/customer-api';
import { storeFile } from '@/lib/server/storage';

/**
 * A player's profile photo. The browser crops and shrinks the picture
 * before sending it, so what arrives is a small square image; this stores
 * it and points the player's profile at it. Under /customer/ so middleware
 * requires a player session.
 */
const TYPES: Record<string, string> = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'image/png': 'png',
};
const MAX_BYTES = 2 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const file = (await req.formData()).get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Choose a photo to upload.' }, { status: 400 });
  }
  const extension = TYPES[file.type];
  if (!extension) {
    return NextResponse.json({ error: 'Use a JPG, PNG or WebP photo.' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Photos must be 2MB or smaller.' }, { status: 400 });
  }

  try {
    const avatarUrl = await storeFile({
      key: `avatars/${randomUUID()}.${extension}`,
      body: Buffer.from(await file.arrayBuffer()),
      contentType: file.type,
    });
    await customerMutate('/me/profile', 'PATCH', { avatarUrl });
    return NextResponse.json({ avatarUrl });
  } catch (error) {
    console.error('Error saving profile photo:', error);
    return NextResponse.json(
      { error: 'Your photo couldn’t be saved. Try again.' },
      { status: 502 },
    );
  }
}

export async function DELETE() {
  try {
    await customerMutate('/me/profile', 'PATCH', { avatarUrl: null });
    return NextResponse.json({ avatarUrl: null });
  } catch {
    return NextResponse.json(
      { error: 'Your photo couldn’t be removed. Try again.' },
      { status: 502 },
    );
  }
}
