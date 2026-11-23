import { existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The URL of a file in public/, or null when it isn't there yet. Lets a
 * page leave a slot for artwork (mascot poses, badge medals) that renders
 * only once the file has been added.
 */
export function publicAsset(path: string): string | null {
  return existsSync(join(process.cwd(), 'public', path)) ? `/${path}` : null;
}
