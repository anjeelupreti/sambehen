import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  Max,
  MinLength,
} from 'class-validator';
import { Public } from '@common/decorators/auth.decorators';
import { ResponseMessage } from '@common/decorators/response-message.decorator';
import { ApiErrors, ApiOkMessage } from '@common/swagger/api-response.decorators';
import { MailerService } from '@shared/mailer/mailer.service';

export class ContactRequestDto {
  @ApiProperty({ example: 'Cody Wallace' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiProperty({ example: 'cody@example.com' })
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @ApiProperty({ example: 'Lone Oak Gaming' })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  company!: string;

  @ApiPropertyOptional({ description: 'How many stores the operator runs.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  stores?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  message?: string;

  /** Left empty by people; filled in by bots that complete every field. */
  @ApiPropertyOptional({ description: 'Leave empty.' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;
}

/**
 * The public "book a demo" form. Sends the request to the sales inbox
 * (CONTACT_INBOX) through the same mailer as everything else. Nothing is
 * stored, so there is no new personal data to look after.
 */
@ApiTags('Contact')
@Controller('contact')
export class ContactController {
  private readonly logger = new Logger(ContactController.name);

  constructor(
    private readonly mailer: MailerService,
    private readonly config: ConfigService,
  ) {}

  @Post()
  @Public()
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @ResponseMessage('Thanks, we will be in touch')
  @ApiOperation({ summary: 'Request a demo' })
  @ApiOkMessage()
  @ApiErrors(422, 429, 503)
  async create(@Body() body: ContactRequestDto): Promise<void> {
    // A filled honeypot is a bot: accept quietly, send nothing.
    if (body.website) return;

    const inbox = this.config.get<string>('CONTACT_INBOX');
    if (!inbox) {
      this.logger.warn('Demo request received but CONTACT_INBOX is not set');
      throw new ServiceUnavailableException('The contact form is not available right now.');
    }

    const lines = [
      `Name: ${body.name}`,
      `Email: ${body.email}`,
      `Company: ${body.company}`,
      `Stores: ${body.stores ?? 'Not given'}`,
      '',
      body.message?.trim() || '(No message)',
    ];
    const result = await this.mailer.send({
      to: inbox,
      subject: `Demo request: ${body.company}`,
      text: lines.join('\n'),
    });
    if (!result.success) {
      this.logger.error(`Demo request could not be sent: ${result.error ?? 'unknown error'}`);
      throw new ServiceUnavailableException('The contact form is not available right now.');
    }
  }
}
