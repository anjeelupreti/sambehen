import * as ExcelJS from 'exceljs';

import { CustomerImportService } from '../customer-import.service';
import { DrizzleDB } from '@database/database.provider';
import { CustomerRepository } from '@database/repositories/customer.repository';
import { AuditService } from '@shared/audit/audit.service';
import { CustomerAssignmentService } from '@modules/staff/customer-assignment.service';
import { AuthRealm, StaffRole } from '@common/constants/app.constants';
import { ValidationException } from '@common/exceptions/business.exception';
import type { ICurrentStaff } from '@common/interfaces/auth.interface';

/**
 * Import is the one bulk write in the system, so the two properties worth
 * proving are that a bad row is reported rather than swallowed, and that a
 * failed import writes nothing at all.
 */

const MASTER: ICurrentStaff = {
  id: '11111111-1111-4111-8111-111111111111',
  realm: AuthRealm.TEAM,
  email: 'master@test.local',
  username: 'master',
  role: StaffRole.MASTER,
  parentId: null,
};

/** Builds an .xlsx in memory so the parser is exercised for real. */
async function sheet(rows: (string | undefined)[][], header: string[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Customers');
  worksheet.addRow(header);
  for (const row of rows) worksheet.addRow(row);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

describe('CustomerImportService', () => {
  let service: CustomerImportService;
  let existingValues: string[];
  let inserted: unknown[][];
  let transactionShouldFail: boolean;

  beforeEach(() => {
    existingValues = [];
    inserted = [];
    transactionShouldFail = false;

    const db = {
      // Stands in for the "which of these already exist" lookup.
      select: () => ({
        from: () => ({
          where: () => Promise.resolve(existingValues.map((value) => ({ value }))),
        }),
      }),
      transaction: async (work: (tx: unknown) => Promise<unknown>) => {
        const captured: unknown[][] = [];
        const tx = {
          insert: () => ({
            values: (rows: unknown[]) => ({
              returning: () => {
                if (transactionShouldFail) {
                  throw new Error('constraint violation');
                }
                captured.push(rows);
                return Promise.resolve(rows.map((_, index) => ({ id: `id-${index}` })));
              },
            }),
          }),
        };

        try {
          const result = await work(tx);
          // Only visible once the transaction committed, which is the
          // behaviour under test.
          inserted.push(...captured);
          return result;
        } catch (error) {
          throw error;
        }
      },
    } as unknown as DrizzleDB;

    service = new CustomerImportService(
      db,
      {} as CustomerRepository,
      {
        resolveOwnership: () =>
          Promise.resolve({ ownerStaffId: 'owner', managerId: 'm', storeId: null }),
      } as unknown as CustomerAssignmentService,
      { record: () => Promise.resolve() } as unknown as AuditService,
    );
  });

  describe('preview', () => {
    it('accepts a well-formed sheet and writes nothing', async () => {
      const buffer = await sheet(
        [
          ['ada@example.com', 'ada', 'Ada Lovelace'],
          ['grace@example.com', 'grace', 'Grace Hopper'],
        ],
        ['Email', 'Username', 'Full Name'],
      );

      const result = await service.preview(buffer);

      expect(result.valid).toHaveLength(2);
      expect(result.issues).toHaveLength(0);
      expect(result.totalRows).toBe(2);
      expect(inserted).toHaveLength(0);
    });

    it('matches headers regardless of case, spacing or wording', async () => {
      const buffer = await sheet(
        [['ada@example.com', 'ada', '+123']],
        ['  E-Mail ', 'HANDLE', 'Mobile'],
      );

      const result = await service.preview(buffer);

      expect(result.valid[0]).toMatchObject({
        email: 'ada@example.com',
        username: 'ada',
        phone: '+123',
      });
    });

    it('reports every bad row rather than stopping at the first', async () => {
      const buffer = await sheet(
        [
          ['not-an-email', 'ada'],
          ['grace@example.com', 'gr'],
          ['', ''],
          ['valid@example.com', 'valid'],
        ],
        ['Email', 'Username'],
      );

      const result = await service.preview(buffer);

      // Two problems reported, the blank spacer ignored, the good row kept.
      expect(result.issues).toHaveLength(2);
      expect(result.issues.map((issue) => issue.field)).toEqual(['email', 'username']);
      expect(result.valid).toHaveLength(1);
      expect(result.valid[0].username).toBe('valid');
    });

    it('flags a row that duplicates another row in the same file', async () => {
      const buffer = await sheet(
        [
          ['ada@example.com', 'ada'],
          ['ada@example.com', 'ada2'],
        ],
        ['Email', 'Username'],
      );

      const result = await service.preview(buffer);

      expect(result.valid).toHaveLength(1);
      expect(result.issues[0].message).toMatch(/Duplicate of row 1/);
    });

    it('flags a row that collides with a customer who already exists', async () => {
      existingValues = ['ada@example.com'];

      const buffer = await sheet([['ada@example.com', 'ada']], ['Email', 'Username']);
      const result = await service.preview(buffer);

      expect(result.valid).toHaveLength(0);
      expect(result.issues[0].message).toMatch(/already exists/);
    });

    it('refuses a sheet with no email column', async () => {
      const buffer = await sheet([['ada']], ['Username']);

      await expect(service.preview(buffer)).rejects.toBeInstanceOf(ValidationException);
    });

    it('refuses a file that is not a spreadsheet', async () => {
      await expect(service.preview(Buffer.from('not a workbook'))).rejects.toBeInstanceOf(
        ValidationException,
      );
    });
  });

  describe('commit', () => {
    const rows = [
      { rowNumber: 1, email: 'ada@example.com', username: 'ada' },
      { rowNumber: 2, email: 'grace@example.com', username: 'grace' },
    ];

    it('writes every row when none collide', async () => {
      const result = await service.commit(MASTER, { rows, password: 'Password123!' });

      expect(result.imported).toBe(2);
      expect(inserted[0]).toHaveLength(2);
    });

    it('writes nothing when any row collides', async () => {
      existingValues = ['grace@example.com'];

      await expect(
        service.commit(MASTER, { rows, password: 'Password123!' }),
      ).rejects.toBeInstanceOf(ValidationException);

      // The whole point: row 1 was importable, and it must not have landed.
      expect(inserted).toHaveLength(0);
    });

    it('writes nothing when the transaction itself fails', async () => {
      transactionShouldFail = true;

      await expect(service.commit(MASTER, { rows, password: 'Password123!' })).rejects.toThrow();
      expect(inserted).toHaveLength(0);
    });
  });
});
