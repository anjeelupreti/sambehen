import { Writable } from 'stream';
import type { ConfigService } from '@nestjs/config';

import { AuthRealm, ExportFormat, StaffRole } from '@common/constants/app.constants';
import { ValidationException } from '@common/exceptions/business.exception';
import type { ICurrentStaff } from '@common/interfaces/auth.interface';
import { ExportService } from '../export.service';
import { ExportWriterService } from '../export-writer.service';

/**
 * `stream()` sets response headers before it starts pulling rows, which
 * means a definition's own upfront check — email-recipients refusing to run
 * without a campaignId — has to fail *before* that point. Get the ordering
 * wrong and the check still throws, but into a response that has already
 * committed to 200, and the caller receives an empty-but-valid file instead
 * of the 422 it was supposed to get.
 */

const ACTOR: ICurrentStaff = {
  id: '11111111-1111-4111-8111-111111111111',
  realm: AuthRealm.TEAM,
  email: 'master@test.local',
  username: 'master',
  role: StaffRole.MASTER,
  parentId: null,
};

function fakeResponse() {
  const chunks: string[] = [];
  const headers: Record<string, string> = {};

  const writable = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(chunk.toString());
      callback();
    },
  }) as Writable & { setHeader: (key: string, value: string) => void };

  writable.setHeader = (key: string, value: string) => {
    headers[key] = value;
  };

  return { writable, chunks, headers };
}

describe('ExportService', () => {
  let service: ExportService;
  let auditService: { record: jest.Mock };

  beforeEach(() => {
    auditService = { record: jest.fn().mockResolvedValue(undefined) };
    const configService = { get: (_key: string, fallback: unknown) => fallback } as ConfigService;

    service = new ExportService(
      new ExportWriterService(configService),
      auditService as never,
      configService,
    );
  });

  it('rejects before any header is written when a definition refuses to run', async () => {
    service.register({
      key: 'email-recipients-like',
      sheetName: 'Recipients',
      filename: 'recipients',
      columns: [{ header: 'Id', path: 'id' }],
      fetch: async () => {
        throw new ValidationException([
          { field: 'campaignId', constraint: 'isNotEmpty', message: 'campaignId is required' },
        ]);
      },
    });

    const { writable, headers, chunks } = fakeResponse();

    await expect(
      service.stream(ACTOR, 'email-recipients-like', ExportFormat.CSV, {}, writable as never),
    ).rejects.toBeInstanceOf(ValidationException);

    // The whole point: no Content-Type/Content-Disposition, and nothing
    // written — a client reading the response can tell this was a genuine
    // error, not a spreadsheet with zero rows in it.
    expect(Object.keys(headers)).toHaveLength(0);
    expect(chunks).toHaveLength(0);
  });

  it('writes every row a definition returns, and records the true count', async () => {
    const rows = [{ id: 'row-0' }, { id: 'row-1' }, { id: 'row-2' }];

    service.register({
      key: 'small-list',
      sheetName: 'Small',
      filename: 'small',
      columns: [{ header: 'Id', path: 'id' }],
      fetch: async (_actor, _filters, page) => rows.slice(page.offset, page.offset + page.limit),
    });

    const { writable, chunks } = fakeResponse();

    await service.stream(ACTOR, 'small-list', ExportFormat.CSV, {}, writable as never);

    const body = chunks.join('');
    expect(body).toContain('row-0');
    expect(body).toContain('row-1');
    expect(body).toContain('row-2');

    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: expect.objectContaining({ rowCount: 3 }) }),
    );
  });
});
