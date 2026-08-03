import { Controller, Get, Inject, Param } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { eq } from 'drizzle-orm';
import { ErrorCode } from '@common/constants/error-codes';
import { ResourceNotFoundException } from '@common/exceptions/business.exception';
import { Public } from '@common/decorators/auth.decorators';
import { ResponseMessage } from '@common/decorators/response-message.decorator';
import { ApiOkData, ApiErrors } from '@common/swagger/api-response.decorators';
import { ParseUUIDPipe } from '@common/pipes/parse-uuid.pipe';
import { HashUtil } from '@common/utils/hash.util';
import { DRIZZLE_PROVIDER, DrizzleDB } from '@database/database.provider';
import { customers } from '@database/schema/customers.schema';
import { AuditService } from '@shared/audit/audit.service';

/**
 * One-click opt-out, reached from the footer of a marketing email.
 *
 * Public by necessity: someone who no longer wants mail should not have to
 * log in to stop it. The link is protected by a token derived from the
 * customer id and the app secret, so it can be verified without storing
 * anything and cannot be forged for another customer by editing the URL.
 *
 * Comparison is constant-time, since a timing-variable check on a
 * guessable identifier is exactly the shape of a token-recovery attack.
 */
@ApiTags('Email')
@Controller('public/unsubscribe')
export class UnsubscribeController {
  constructor(
    @Inject(DRIZZLE_PROVIDER) private readonly db: DrizzleDB,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
  ) {}

  @Get(':customerId/:token')
  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ResponseMessage('You have been unsubscribed')
  @ApiParam({ name: 'customerId', format: 'uuid' })
  @ApiParam({ name: 'token', description: 'Signature from the email footer.' })
  @ApiOperation({
    summary: 'Unsubscribe from marketing email',
    description:
      'Unauthenticated, reached from an email footer. Sets emailOptOut, which removes the customer from every future campaign audience at the query level. Transactional and account mail is unaffected — those are not marketing and carry no opt-out link.',
  })
  @ApiOkData(Object, 'Unsubscribed')
  @ApiErrors(404, 429)
  async unsubscribe(
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Param('token') token: string,
  ): Promise<{ unsubscribed: boolean }> {
    const secret = this.configService.getOrThrow<string>('jwt.secret');
    const expected = HashUtil.sha256(`${customerId}:${secret}`).slice(0, 32);

    if (!HashUtil.safeEquals(token, expected)) {
      // Deliberately the same response as an unknown customer, so the
      // endpoint reveals nothing about which ids exist.
      throw new ResourceNotFoundException(
        ErrorCode.NOT_FOUND,
        'This unsubscribe link is not valid',
      );
    }

    const [updated] = await this.db
      .update(customers)
      .set({ emailOptOut: true })
      .where(eq(customers.id, customerId))
      .returning({ id: customers.id });

    if (!updated) {
      throw new ResourceNotFoundException(
        ErrorCode.NOT_FOUND,
        'This unsubscribe link is not valid',
      );
    }

    // Recorded as a system action: nobody was signed in to perform it, but
    // a change to a customer's contact preferences must still be traceable.
    await this.auditService.record({
      actorType: 'system',
      action: 'customer.email_opt_out',
      entityType: 'customer',
      entityId: customerId,
      after: { emailOptOut: true },
      metadata: { source: 'unsubscribe_link' },
    });

    return { unsubscribed: true };
  }
}
