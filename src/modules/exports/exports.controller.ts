import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiProduces,
  ApiOkResponse,
} from '@nestjs/swagger';
import { Response } from 'express';
import { ExportFormat } from '@common/constants/app.constants';
import { TeamAuth } from '@common/decorators/composite-auth.decorator';
import { CurrentStaff } from '@common/decorators/auth.decorators';
import { RawResponse } from '@common/decorators/raw-response.decorator';
import { ResponseMessage } from '@common/decorators/response-message.decorator';
import { ApiOkData, ApiErrors } from '@common/swagger/api-response.decorators';
import { ICurrentStaff } from '@common/interfaces/auth.interface';
import { ExportService } from './export.service';
import { EXPORT_KEYS } from './export-definitions';

/**
 * Spreadsheet exports.
 *
 * Every export delegates to the same service method its HTTP list uses, so
 * it returns exactly what that actor would see on screen, with the same
 * filters. Building a separate query per export is the usual way scoping
 * gets bypassed, so there is deliberately no way to do that here.
 *
 * Each download is audit-logged with the actor, the filters and the row
 * count: PII is leaving the system, and that has to be reconstructable.
 */
@ApiTags('Exports')
@Controller('team/exports')
@TeamAuth()
export class ExportsController {
  constructor(private readonly exportService: ExportService) {}

  @Get()
  @ResponseMessage('Exportable lists retrieved successfully')
  @ApiOperation({
    summary: 'List the exportable resources',
    description:
      "Each key can be downloaded from /team/exports/{key} with that list's own filters.",
  })
  @ApiOkData(Object)
  @ApiErrors(401)
  listDefinitions(): { key: string; sheetName: string; columns: number }[] {
    return this.exportService.list();
  }

  @Get(':key/count')
  @ResponseMessage('Row count retrieved successfully')
  @ApiParam({ name: 'key', enum: EXPORT_KEYS })
  @ApiOperation({
    summary: 'How many rows this export would produce',
    description:
      'Lets a client warn before starting a large download, and returns EXPORT_TOO_LARGE past the configured cap so the user narrows the filters rather than waiting on a file that will be truncated.',
  })
  @ApiOkData(Object)
  @ApiErrors(401, 404, 422)
  async count(
    @CurrentStaff() actor: ICurrentStaff,
    @Param('key') key: string,
    @Query() filters: Record<string, unknown>,
  ): Promise<{ rowCount: number }> {
    return { rowCount: await this.exportService.count(actor, key, filters) };
  }

  @Get(':key')
  // The envelope would corrupt a binary body, so this route opts out of it.
  // Errors raised before the stream opens still return the normal JSON
  // error envelope, since the exception filter is unaffected.
  @RawResponse()
  @ApiParam({ name: 'key', enum: EXPORT_KEYS })
  @ApiQuery({
    name: 'format',
    required: false,
    enum: ExportFormat,
    description: 'xlsx (default) or csv.',
  })
  @ApiProduces('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv')
  @ApiOperation({
    summary: 'Download a list as a spreadsheet',
    description: [
      'Accepts the same query parameters as the corresponding list endpoint and returns',
      'exactly the rows that list would return for this actor — scope included.',
      '',
      'Money is written as real numeric cells with a 2dp format, not strings, so the',
      'recipient can SUM() the column. Dates are rendered in EXPORT_TIMEZONE, since a',
      'spreadsheet has no timezone concept and must commit to one.',
      '',
      'Rows are streamed in batches, so memory stays flat regardless of size.',
    ].join(' '),
  })
  @ApiOkResponse({
    description: 'Binary spreadsheet stream',
    content: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
        schema: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiErrors(401, 403, 404, 422)
  async download(
    @CurrentStaff() actor: ICurrentStaff,
    @Param('key') key: string,
    @Query('format') format: ExportFormat = ExportFormat.XLSX,
    @Query() filters: Record<string, unknown>,
    @Res() response: Response,
  ): Promise<void> {
    // `format` arrives inside the catch-all query object too; remove it so
    // it is never mistaken for a list filter.
    const listFilters = { ...filters };
    delete listFilters.format;

    await this.exportService.stream(actor, key, format, listFilters, response);
  }
}
