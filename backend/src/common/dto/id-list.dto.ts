import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsUUID, ArrayNotEmpty, ArrayMaxSize } from 'class-validator';

/** Upper bound on a single bulk operation, keeping one request bounded. */
export const MAX_BULK_IDS = 500;

/**
 * Payload for bulk actions (activate, deactivate, reassign, assign
 * referral codes, select email recipients).
 *
 * The ids are always intersected with the actor's scope by the service
 * layer, so supplying an id outside the caller's chain silently drops it
 * rather than acting on it.
 */
export class IdListDto {
  @ApiProperty({
    type: [String],
    format: 'uuid',
    maxItems: MAX_BULK_IDS,
    example: ['8f3c1e7a-2b4d-4c9f-9e1a-0d5b6c7a8e2f'],
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(MAX_BULK_IDS)
  @IsUUID('4', { each: true })
  ids!: string[];
}
