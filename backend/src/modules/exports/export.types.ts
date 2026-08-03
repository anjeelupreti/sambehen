import { SQL } from 'drizzle-orm';
import { ICurrentStaff } from '@common/interfaces/auth.interface';

/** How a value is rendered into a spreadsheet cell. */
export type ExportColumnFormat =
  /** Real numeric cell with 2dp, so the recipient can SUM() the column. */
  | 'currency'
  /** Excel date cell in the configured export timezone. */
  | 'datetime'
  | 'date'
  /** Yes / No rather than true / false. */
  | 'boolean'
  /** Plain integer. */
  | 'number'
  | 'text';

export interface IExportColumn {
  header: string;
  /** Dot path into the row, e.g. `manager.username`. */
  path: string;
  format?: ExportColumnFormat;
  width?: number;
}

/**
 * Everything needed to export one list.
 *
 * `fetch` is deliberately the ONLY way rows are obtained, and every
 * registered definition delegates to the same service method its HTTP list
 * uses. An export that built its own query could return rows the list
 * would not — which is how scoping quietly gets bypassed.
 */
/** A row is any object; columns address it by dotted path. */
export type ExportRow = object;

export interface IExportDefinition<TRow extends ExportRow = ExportRow> {
  /** Stable key used in the URL and in audit entries. */
  key: string;
  /** Sheet name inside the workbook. Excel caps this at 31 characters. */
  sheetName: string;
  /** Filename stem; the date and row count are appended. */
  filename: string;
  columns: IExportColumn[];
  /**
   * Returns rows for the actor, honouring the same scope and filters as
   * the list. Called in pages so a large export never materialises whole.
   */
  fetch: (
    actor: ICurrentStaff,
    filters: Record<string, unknown>,
    page: IExportPage,
  ) => Promise<TRow[]>;
  /** Roles permitted to export this resource, when narrower than reading it. */
  allowedRoles?: string[];
}

/** Page window for batched fetching. */
export interface IExportPage {
  offset: number;
  limit: number;
}

export interface IExportRequest {
  definitionKey: string;
  format: 'xlsx' | 'csv';
  filters: Record<string, unknown>;
}

/** Predicates a definition may reuse when it builds its own query. */
export type ScopedConditionBuilder = (
  actor: ICurrentStaff,
  filters: Record<string, unknown>,
) => Promise<SQL[]>;
