import { Inject, Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { inArray } from 'drizzle-orm';

import { DRIZZLE_PROVIDER, DrizzleDB } from '@database/database.provider';
import { customers } from '@database/schema';
import { StaffRole } from '@common/constants/app.constants';
import { ValidationException } from '@common/exceptions/business.exception';
import { HashUtil } from '@common/utils/hash.util';
import type { ICurrentStaff } from '@common/interfaces/auth.interface';

import {
  CommitImportDto,
  CommitImportResponseDto,
  ImportCustomerRowDto,
  ImportPreviewResponseDto,
  ImportRowIssueDto,
} from './dto/import.dto';
import { CustomerRepository } from '@database/repositories/customer.repository';
import { AuditService } from '@shared/audit/audit.service';
import { CustomerAssignmentService } from '@modules/staff/customer-assignment.service';

/**
 * Bulk customer import.
 *
 * Deliberately two operations rather than one upload-and-write:
 *
 * **Preview** parses the file, validates every row and returns what would
 * happen — without touching the database. A spreadsheet of a few hundred
 * customers is exactly where a mis-mapped column does real damage, and if
 * the write happens on upload that damage is only discovered afterwards.
 *
 * **Commit** takes back the rows the operator confirmed and writes them in
 * a single transaction. All or nothing: a file where row 200 collides with
 * an existing username must not leave 199 customers behind, because there
 * is no sensible way to resume from a half-finished import.
 *
 * Commit receives rows rather than the file again, so what is written is
 * what the operator actually reviewed rather than a re-parse that might
 * differ.
 */
@Injectable()
export class CustomerImportService {
  /** Header names accepted for each field, lowercased and stripped. */
  private static readonly COLUMNS: Record<string, string[]> = {
    email: ['email', 'emailaddress', 'e-mail'],
    username: ['username', 'user', 'handle'],
    fullName: ['fullname', 'name', 'customername'],
    phone: ['phone', 'phonenumber', 'mobile', 'contact'],
    city: ['city', 'town'],
    country: ['country'],
  };

  private static readonly MAX_ROWS = 500;

  constructor(
    @Inject(DRIZZLE_PROVIDER) private readonly db: DrizzleDB,
    private readonly customerRepository: CustomerRepository,
    private readonly assignmentService: CustomerAssignmentService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Parses and validates a spreadsheet. Writes nothing.
   *
   * Every problem is reported against its own row rather than failing on
   * the first one — an operator fixing a file needs the whole list, not one
   * error at a time.
   */
  async preview(buffer: Buffer): Promise<ImportPreviewResponseDto> {
    const workbook = new ExcelJS.Workbook();

    try {
      await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
    } catch {
      throw new ValidationException([
        { field: 'file', constraint: 'unreadable', message: 'That file is not a readable .xlsx' },
      ]);
    }

    const sheet = workbook.worksheets[0];
    if (!sheet || sheet.rowCount < 2) {
      throw new ValidationException([
        {
          field: 'file',
          constraint: 'empty',
          message: 'The sheet has no data rows beneath its header',
        },
      ]);
    }

    const columns = this.mapHeader(sheet);

    for (const required of ['email', 'username'] as const) {
      if (columns[required] === undefined) {
        throw new ValidationException([
          {
            field: 'file',
            constraint: 'missingColumn',
            message: `The sheet needs an "${required}" column`,
          },
        ]);
      }
    }

    const valid: ImportCustomerRowDto[] = [];
    const issues: ImportRowIssueDto[] = [];

    // Collected first so duplicates can be checked in two queries rather
    // than two per row.
    const parsed: ImportCustomerRowDto[] = [];

    let totalRows = 0;
    sheet.eachRow((row, index) => {
      if (index === 1) return; // header
      totalRows += 1;

      const rowNumber = index - 1;
      if (rowNumber > CustomerImportService.MAX_ROWS) return;

      const cell = (key: keyof typeof CustomerImportService.COLUMNS): string => {
        const column = columns[key];
        if (column === undefined) return '';
        const value = row.getCell(column).value;
        if (value === null || value === undefined) return '';
        // A cell holding a formula or a hyperlink is an object; take its
        // rendered text rather than serialising the object into the field.
        if (typeof value === 'object' && 'text' in value) return String(value.text).trim();
        if (typeof value === 'object' && 'result' in value) return String(value.result).trim();
        return String(value).trim();
      };

      const email = cell('email').toLowerCase();
      const username = cell('username');

      if (!email && !username) return; // a blank spacer row, not an error

      const rowIssues: ImportRowIssueDto[] = [];
      if (!email) {
        rowIssues.push({ rowNumber, field: 'email', message: 'Email is required' });
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        rowIssues.push({ rowNumber, field: 'email', message: 'That is not a valid email address' });
      }

      if (!username) {
        rowIssues.push({ rowNumber, field: 'username', message: 'Username is required' });
      } else if (username.length < 3) {
        rowIssues.push({
          rowNumber,
          field: 'username',
          message: 'Username must be at least 3 characters',
        });
      }

      if (rowIssues.length > 0) {
        issues.push(...rowIssues);
        return;
      }

      parsed.push({
        rowNumber,
        email,
        username,
        fullName: cell('fullName') || undefined,
        phone: cell('phone') || undefined,
        city: cell('city') || undefined,
        country: cell('country') || undefined,
      });
    });

    // Collisions inside the file itself. Checked before the database,
    // because two identical rows in one sheet is a mistake in the sheet.
    const seenEmails = new Map<string, number>();
    const seenUsernames = new Map<string, number>();
    const deduped: ImportCustomerRowDto[] = [];

    for (const row of parsed) {
      const emailAt = seenEmails.get(row.email);
      const usernameAt = seenUsernames.get(row.username.toLowerCase());

      if (emailAt !== undefined) {
        issues.push({
          rowNumber: row.rowNumber,
          field: 'email',
          message: `Duplicate of row ${emailAt} in this file`,
        });
        continue;
      }
      if (usernameAt !== undefined) {
        issues.push({
          rowNumber: row.rowNumber,
          field: 'username',
          message: `Duplicate of row ${usernameAt} in this file`,
        });
        continue;
      }

      seenEmails.set(row.email, row.rowNumber);
      seenUsernames.set(row.username.toLowerCase(), row.rowNumber);
      deduped.push(row);
    }

    // Collisions with customers who already exist — two queries for the
    // whole file rather than two per row.
    const [takenEmails, takenUsernames] = await Promise.all([
      this.existing(
        'email',
        deduped.map((row) => row.email),
      ),
      this.existing(
        'username',
        deduped.map((row) => row.username),
      ),
    ]);

    for (const row of deduped) {
      if (takenEmails.has(row.email.toLowerCase())) {
        issues.push({
          rowNumber: row.rowNumber,
          field: 'email',
          message: 'A customer with this email already exists',
        });
        continue;
      }
      if (takenUsernames.has(row.username.toLowerCase())) {
        issues.push({
          rowNumber: row.rowNumber,
          field: 'username',
          message: 'A customer with this username already exists',
        });
        continue;
      }
      valid.push(row);
    }

    issues.sort((a, b) => a.rowNumber - b.rowNumber);

    return { valid, issues, totalRows };
  }

  /**
   * Writes the confirmed rows in one transaction.
   *
   * Re-checks for collisions inside the transaction. Preview may have run
   * minutes ago, and a customer created in between would otherwise slip
   * past — the check that matters is the one at write time.
   */
  async commit(actor: ICurrentStaff, dto: CommitImportDto): Promise<CommitImportResponseDto> {
    const ownerStaffId = actor.role === StaffRole.STORE ? actor.id : (dto.ownerStaffId ?? actor.id);

    const ownership = await this.assignmentService.resolveOwnership(ownerStaffId);
    const passwordHash = await HashUtil.hashPassword(dto.password);

    const emails = dto.rows.map((row) => row.email.toLowerCase());
    const usernames = dto.rows.map((row) => row.username.toLowerCase());

    const [takenEmails, takenUsernames] = await Promise.all([
      this.existing('email', emails),
      this.existing('username', usernames),
    ]);

    const collisions = dto.rows.filter(
      (row) =>
        takenEmails.has(row.email.toLowerCase()) || takenUsernames.has(row.username.toLowerCase()),
    );

    if (collisions.length > 0) {
      // Nothing is written. Reported as a validation failure listing every
      // offending row, so the operator can fix the file rather than guess
      // which line moved.
      throw new ValidationException(
        collisions.map((row) => ({
          field: `row.${row.rowNumber}`,
          constraint: 'conflict',
          message: `${row.username} (${row.email}) already exists — nothing was imported`,
        })),
      );
    }

    const customerIds = await this.db.transaction(async (tx) => {
      const inserted = await tx
        .insert(customers)
        .values(
          dto.rows.map((row) => ({
            email: row.email,
            username: row.username,
            passwordHash,
            fullName: row.fullName ?? null,
            phone: row.phone ?? null,
            city: row.city ?? null,
            country: row.country ?? null,
            ...ownership,
            createdByStaffId: actor.id,
          })),
        )
        .returning({ id: customers.id });

      return inserted.map((row) => row.id);
    });

    await this.auditService.record({
      actorType: 'staff',
      actorId: actor.id,
      actorRole: actor.role,
      action: 'customer.imported',
      entityType: 'customer',
      entityId: null,
      metadata: { imported: customerIds.length, ownerStaffId },
    });

    return { imported: customerIds.length, customerIds };
  }

  /** Header row → column index, tolerant of spacing, case and wording. */
  private mapHeader(sheet: ExcelJS.Worksheet): Record<string, number | undefined> {
    const header = sheet.getRow(1);
    const columns: Record<string, number | undefined> = {};

    header.eachCell((cell, index) => {
      const label = String(cell.value ?? '')
        .toLowerCase()
        .replace(/[^a-z]/g, '');

      for (const [field, aliases] of Object.entries(CustomerImportService.COLUMNS)) {
        if (columns[field] === undefined && aliases.includes(label)) {
          columns[field] = index;
        }
      }
    });

    return columns;
  }

  /** Which of these values already belong to a customer. */
  private async existing(field: 'email' | 'username', values: string[]): Promise<Set<string>> {
    if (values.length === 0) return new Set();

    const column = field === 'email' ? customers.email : customers.username;
    const rows = await this.db
      .select({ value: column })
      .from(customers)
      .where(inArray(column, values));

    return new Set(rows.map((row) => String(row.value).toLowerCase()));
  }
}
