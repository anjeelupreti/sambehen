import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { AuthRealm, ExportFormat } from '@common/constants/app.constants';
import { ErrorCode } from '@common/constants/error-codes';
import {
  BusinessException,
  CapabilityDeniedException,
  ResourceNotFoundException,
} from '@common/exceptions/business.exception';
import { ICurrentStaff } from '@common/interfaces/auth.interface';
import { AuditService } from '@shared/audit/audit.service';
import { IExportDefinition, ExportRow } from './export.types';
import { ExportWriterService } from './export-writer.service';

/** Rows fetched per round trip. Large enough to be efficient, small enough to stay flat in memory. */
const BATCH_SIZE = 500;

@Injectable()
export class ExportService {
  private readonly logger = new Logger(ExportService.name);
  private readonly definitions = new Map<string, IExportDefinition>();

  constructor(
    private readonly writer: ExportWriterService,
    private readonly auditService: AuditService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Registers an exportable list.
   *
   * Definitions are registered rather than hard-coded so adding a list
   * later is one object: the streaming, scoping, auditing and formatting
   * all come from here.
   */
  register(definition: IExportDefinition): void {
    this.definitions.set(definition.key, definition as IExportDefinition);
  }

  list(): { key: string; sheetName: string; columns: number }[] {
    return [...this.definitions.values()].map((d) => ({
      key: d.key,
      sheetName: d.sheetName,
      columns: d.columns.length,
    }));
  }

  /**
   * Looks a definition up and applies its role guard.
   *
   * Both the download and the count go through here, because a count is
   * still a disclosure: it tells the caller how many rows sit behind an
   * export they are not allowed to take.
   */
  private resolve(actor: ICurrentStaff, definitionKey: string): IExportDefinition {
    const definition = this.definitions.get(definitionKey);

    if (!definition) {
      throw new ResourceNotFoundException(
        ErrorCode.EXPORT_DEFINITION_NOT_FOUND,
        `No export is defined for "${definitionKey}"`,
      );
    }

    if (definition.allowedRoles && !definition.allowedRoles.includes(actor.role)) {
      throw new CapabilityDeniedException(
        ErrorCode.AUTH_FORBIDDEN_ROLE,
        `Exporting ${definitionKey} requires one of: ${definition.allowedRoles.join(', ')}`,
      );
    }

    return definition;
  }

  /**
   * Streams an export to the response.
   *
   * Rows come from the definition's `fetch`, which delegates to the same
   * service method the HTTP list uses — so the export sees exactly what
   * the list sees, for that actor, with those filters. Building a separate
   * query here is precisely how an export ends up returning rows its list
   * would have hidden.
   */
  async stream(
    actor: ICurrentStaff,
    definitionKey: string,
    format: ExportFormat,
    filters: Record<string, unknown>,
    response: Response,
  ): Promise<void> {
    const definition = this.resolve(actor, definitionKey);

    const rowCap = this.configService.get<number>('business.exportSyncRowLimit', 50_000);
    const stamp = new Date().toISOString().slice(0, 10);
    const extension = format === ExportFormat.CSV ? 'csv' : 'xlsx';
    const filename = `${definition.filename}_${stamp}.${extension}`;

    // Headers are set before the first row: once the body starts streaming
    // it is too late to change status or content type, which is also why
    // any error must be raised before this point.
    response.setHeader(
      'Content-Type',
      format === ExportFormat.CSV
        ? 'text/csv; charset=utf-8'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    response.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    let capExceeded = false;

    const batches = async function* (this: ExportService): AsyncGenerator<ExportRow[]> {
      let offset = 0;
      let fetched = 0;

      for (;;) {
        const batch = await definition.fetch(actor, filters, { offset, limit: BATCH_SIZE });
        if (batch.length === 0) return;

        fetched += batch.length;
        if (fetched > rowCap) {
          // Truncating silently would hand someone an incomplete file they
          // believed was complete, so the export stops and the audit entry
          // records that it was capped.
          capExceeded = true;
          yield batch.slice(0, rowCap - (fetched - batch.length));
          return;
        }

        yield batch;
        if (batch.length < BATCH_SIZE) return;
        offset += BATCH_SIZE;
      }
    }.call(this);

    const rowCount =
      format === ExportFormat.CSV
        ? await this.writer.writeCsv(response, definition.columns, batches)
        : await this.writer.writeXlsx(response, definition.sheetName, definition.columns, batches);

    // PII is leaving the system, so who exported what, with which filters,
    // and how many rows must be reconstructable afterwards.
    await this.auditService.record({
      actorType: AuthRealm.TEAM,
      actorId: actor.id,
      actorRole: actor.role,
      action: 'export.download',
      entityType: 'export',
      metadata: {
        definition: definitionKey,
        format,
        filters,
        rowCount,
        capExceeded,
        filename,
      },
    });

    this.logger.log(
      `Export "${definitionKey}" by ${actor.username}: ${rowCount} row(s)${capExceeded ? ' (capped)' : ''}`,
    );
  }

  /** Row count for a filter, so a client can warn before a huge download. */
  async count(
    actor: ICurrentStaff,
    definitionKey: string,
    filters: Record<string, unknown>,
  ): Promise<number> {
    // Resolved through the same helper as the download, so the role guard
    // cannot be enforced on one path and forgotten on the other — a count
    // still discloses how much data exists behind a restricted export.
    const definition = this.resolve(actor, definitionKey);

    const rowCap = this.configService.get<number>('business.exportSyncRowLimit', 50_000);
    let offset = 0;
    let total = 0;

    for (;;) {
      const batch = await definition.fetch(actor, filters, { offset, limit: BATCH_SIZE });
      total += batch.length;

      if (batch.length < BATCH_SIZE) break;
      if (total > rowCap) {
        throw new BusinessException(
          ErrorCode.EXPORT_TOO_LARGE,
          `This export exceeds the ${rowCap} row limit. Narrow the filters and try again.`,
          undefined,
          { rowCap },
        );
      }
      offset += BATCH_SIZE;
    }

    return total;
  }
}
