import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CustomerAuth } from '@common/decorators/composite-auth.decorator';
import { CurrentCustomer } from '@common/decorators/auth.decorators';
import { ResponseMessage } from '@common/decorators/response-message.decorator';
import { ApiOkData, ApiErrors } from '@common/swagger/api-response.decorators';
import { ICurrentCustomer } from '@common/interfaces/auth.interface';
import { CustomerRepository } from '@database/repositories/customer.repository';
import { ErrorCode } from '@common/constants/error-codes';
import { ResourceNotFoundException } from '@common/exceptions/business.exception';
import { CustomerProfileDto } from '@modules/auth/dto/auth.dto';

/**
 * Customer-facing portal.
 *
 * Read-only by design. Customers cannot update their profile, credentials
 * or status: those are performed by the master, their manager, or their
 * runner, and are audit-logged. There is deliberately no PATCH here — the
 * absence is the requirement, not an omission.
 *
 * Every route resolves the customer from the authenticated token, never
 * from a path parameter, so one customer cannot address another's data.
 *
 * Grows in later phases with VIP status, transactions, referral details,
 * recent winners and messaging.
 */
@ApiTags('Customer Portal')
@Controller('me')
export class PortalController {
  constructor(private readonly customerRepository: CustomerRepository) {}

  @Get('profile')
  @CustomerAuth()
  @ResponseMessage('Profile retrieved successfully')
  @ApiOperation({
    summary: "The signed-in customer's own profile",
    description:
      "Read-only. Profile and credential changes are made by staff on the customer's behalf. Internal ownership fields (owning manager and runner) are omitted, since the customer has no need to see the team structure behind their account.",
  })
  @ApiOkData(CustomerProfileDto)
  @ApiErrors(401, 404)
  async profile(@CurrentCustomer() actor: ICurrentCustomer): Promise<CustomerProfileDto> {
    // Read fresh rather than trusting the token: a status change or
    // profile edit made by staff must be visible immediately, not only
    // after the access token expires.
    const customer = await this.customerRepository.findById(actor.id);

    if (!customer) {
      throw new ResourceNotFoundException(ErrorCode.CUSTOMER_NOT_FOUND, 'Customer not found');
    }

    return {
      id: customer.id,
      email: customer.email,
      username: customer.username,
      fullName: customer.fullName,
      status: customer.status,
      balance: customer.balance,
      bonusBalance: customer.bonusBalance,
      lastLoginAt: customer.lastLoginAt,
    };
  }
}
