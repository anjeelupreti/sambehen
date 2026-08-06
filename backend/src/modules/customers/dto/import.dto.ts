import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

/**
 * Bulk customer import.
 *
 * Two steps on purpose. Preview parses and validates a file and writes
 * nothing; commit takes back the rows the operator confirmed and inserts
 * them in a single transaction. Splitting them is what makes the operation
 * reviewable — a spreadsheet of a few hundred customers is exactly where a
 * mis-mapped column does real damage, and the damage is invisible until
 * afterwards if the write happens on upload.
 *
 * The commit takes rows rather than the file again so that what is written
 * is what the operator actually saw and approved, not a re-parse that might
 * differ.
 */

/** One parsed row, as it will be created. */
export class ImportCustomerRowDto {
  @ApiProperty({ description: 'Row number in the source file, 1-based excluding the header.' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  rowNumber!: number;

  @ApiProperty()
  @IsString()
  email!: string;

  @ApiProperty()
  @IsString()
  username!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsString()
  @IsOptional()
  fullName?: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsString()
  @IsOptional()
  city?: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsString()
  @IsOptional()
  country?: string;
}

/** Why a parsed row cannot be imported. */
export class ImportRowIssueDto {
  @ApiProperty()
  rowNumber!: number;

  @ApiProperty({ example: 'email' })
  field!: string;

  @ApiProperty({ example: 'A customer with this email already exists' })
  message!: string;
}

export class ImportPreviewResponseDto {
  @ApiProperty({ type: [ImportCustomerRowDto], description: 'Rows that can be imported as-is.' })
  valid!: ImportCustomerRowDto[];

  @ApiProperty({
    type: [ImportRowIssueDto],
    description:
      'Rows that cannot. Reported per row rather than as a single failure, so one bad line does not hide the other twenty.',
  })
  issues!: ImportRowIssueDto[];

  @ApiProperty({ description: 'Rows found in the file, excluding the header.' })
  totalRows!: number;
}

export class CommitImportDto {
  @ApiProperty({
    type: [ImportCustomerRowDto],
    maxItems: 500,
    description:
      'The rows the operator confirmed. Sent back rather than re-parsed from the file, so what is written is what was reviewed.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => ImportCustomerRowDto)
  rows!: ImportCustomerRowDto[];

  @ApiProperty({
    description:
      'Password issued to every imported customer. They cannot change it themselves — staff do.',
  })
  @IsString()
  password!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Who owns the imported customers. Required for a master, who sits above the chain; a manager or runner defaults to themselves.',
  })
  @IsUUID('4')
  @IsOptional()
  ownerStaffId?: string;
}

export class CommitImportResponseDto {
  @ApiProperty({ description: 'How many customers were created.' })
  imported!: number;

  @ApiProperty({ type: [String], format: 'uuid' })
  customerIds!: string[];
}
