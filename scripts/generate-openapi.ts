import 'dotenv/config';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from '../src/app.module';
import { createSwaggerDocument } from '../src/swagger';

/**
 * Emits openapi.json for the frontend team — `npm run docs:openapi`.
 *
 * Uses `NestFactory.create` with the logger silenced and never calls
 * `listen()`, so the document is produced from the real route metadata
 * without binding a port. A database connection is still required, since
 * the app graph is instantiated in full.
 */
async function main(): Promise<void> {
  const outputPath = resolve(process.cwd(), process.argv[2] ?? 'openapi.json');

  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix(process.env.API_PREFIX || 'api');

  try {
    const document = createSwaggerDocument(app, app.get(ConfigService));

    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, `${JSON.stringify(document, null, 2)}\n`, 'utf-8');

    const routeCount = Object.keys(document.paths ?? {}).length;
    process.stdout.write(`OpenAPI document written to ${outputPath} (${routeCount} paths)\n`);
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(
    `Failed to generate OpenAPI document: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exit(1);
});
