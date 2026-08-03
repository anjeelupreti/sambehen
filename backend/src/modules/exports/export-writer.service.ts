import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import * as ExcelJS from 'exceljs';
import { IExportColumn, ExportRow } from './export.types';

/**
 * Writes rows into a spreadsheet, streamed to the response.
 *
 * exceljs's WorkbookWriter emits rows as they arrive rather than building
 * the whole file in memory, so a large export uses flat memory regardless
 * of row count. That is the reason for the streaming API rather than the
 * simpler in-memory Workbook.
 */
@Injectable()
export class ExportWriterService {
  constructor(private readonly configService: ConfigService) {}

  /** Reads a dotted path, tolerating missing intermediate objects. */
  private valueAt(row: ExportRow, path: string): unknown {
    return path
      .split('.')
      .reduce<unknown>(
        (acc, key) =>
          acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[key] : undefined,
        row,
      );
  }

  /**
   * Converts a stored value into what the cell should hold.
   *
   * Money becomes a real number, never a string. Amounts are stored as
   * decimal strings so JavaScript floats cannot corrupt them, but writing
   * that string into a cell gives the recipient a text column they cannot
   * SUM() — which defeats the purpose of exporting to a spreadsheet.
   */
  private cellValue(raw: unknown, format?: IExportColumn['format']): unknown {
    if (raw === null || raw === undefined) return null;

    switch (format) {
      case 'currency': {
        const parsed = Number(raw);
        return Number.isFinite(parsed) ? parsed : null;
      }
      case 'number': {
        const parsed = Number(raw);
        return Number.isFinite(parsed) ? parsed : null;
      }
      case 'boolean':
        return raw ? 'Yes' : 'No';
      case 'date':
      case 'datetime':
        return raw instanceof Date ? raw : new Date(String(raw));
      default:
        return typeof raw === 'object' ? JSON.stringify(raw) : raw;
    }
  }

  /** Excel number/date formats per column type. */
  private numberFormat(format?: IExportColumn['format']): string | undefined {
    switch (format) {
      case 'currency':
        return '#,##0.00';
      case 'number':
        return '#,##0';
      case 'date':
        return 'yyyy-mm-dd';
      case 'datetime':
        return 'yyyy-mm-dd hh:mm';
      default:
        return undefined;
    }
  }

  /**
   * Streams an .xlsx to the response.
   *
   * The header row is frozen and filterable, because an exported list is
   * something people scroll and sort rather than read top to bottom.
   */
  async writeXlsx(
    response: Response,
    sheetName: string,
    columns: IExportColumn[],
    rows: AsyncIterable<ExportRow[]>,
  ): Promise<number> {
    const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
      stream: response,
      useStyles: true,
      useSharedStrings: false,
    });

    // Excel refuses sheet names over 31 characters outright.
    const sheet = workbook.addWorksheet(sheetName.slice(0, 31), {
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    sheet.columns = columns.map((column) => ({
      header: column.header,
      key: column.path,
      width: column.width ?? this.defaultWidth(column.format),
      style: { numFmt: this.numberFormat(column.format) },
    }));

    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF1F5F9' },
    };

    let total = 0;
    for await (const batch of rows) {
      for (const row of batch) {
        sheet
          .addRow(
            columns.map((column) => this.cellValue(this.valueAt(row, column.path), column.format)),
          )
          .commit();
        total += 1;
      }
    }

    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
    sheet.commit();
    await workbook.commit();

    return total;
  }

  /**
   * Streams a CSV.
   *
   * Written directly rather than through a library: the escaping rules are
   * three lines, and a dependency that buffers would undo the streaming.
   */
  async writeCsv(
    response: Response,
    columns: IExportColumn[],
    rows: AsyncIterable<ExportRow[]>,
  ): Promise<number> {
    // BOM so Excel opens UTF-8 correctly; without it accented names are
    // mangled on Windows.
    response.write('﻿');
    response.write(`${columns.map((c) => this.escapeCsv(c.header)).join(',')}\n`);

    let total = 0;
    for await (const batch of rows) {
      let chunk = '';
      for (const row of batch) {
        chunk += `${columns
          .map((column) => {
            const value = this.cellValue(this.valueAt(row, column.path), column.format);
            if (value instanceof Date) return this.formatDate(value, column.format);
            return this.escapeCsv(value);
          })
          .join(',')}\n`;
        total += 1;
      }
      response.write(chunk);
    }

    response.end();
    return total;
  }

  private escapeCsv(value: unknown): string {
    if (value === null || value === undefined) return '';
    const text = String(value);
    // Quote when the value contains a delimiter, quote or newline.
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }

  /**
   * Formats a date in the configured export timezone.
   *
   * Spreadsheets have no timezone concept, so an export has to commit to
   * one; leaving values in UTC while the business works in another offset
   * silently shifts every date near midnight.
   */
  private formatDate(value: Date, format?: IExportColumn['format']): string {
    const timeZone = this.configService.get<string>('business.exportTimezone', 'UTC');

    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      ...(format === 'datetime' ? { hour: '2-digit', minute: '2-digit', hour12: false } : {}),
    }).format(value);

    return parts.replace(',', '');
  }

  private defaultWidth(format?: IExportColumn['format']): number {
    switch (format) {
      case 'currency':
        return 14;
      case 'datetime':
        return 18;
      case 'date':
        return 12;
      case 'boolean':
        return 8;
      default:
        return 22;
    }
  }
}
