import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { TeamAuth, CustomerAuth } from '@common/decorators/composite-auth.decorator';
import { CurrentStaff, CurrentCustomer } from '@common/decorators/auth.decorators';
import { ResponseMessage } from '@common/decorators/response-message.decorator';
import { ApiOkData, ApiErrors } from '@common/swagger/api-response.decorators';
import { ICurrentStaff, ICurrentCustomer } from '@common/interfaces/auth.interface';
import { DashboardService } from './dashboard.service';
import {
  DashboardFilterDto,
  TrendQueryDto,
  DashboardResponseDto,
  TrendResponseDto,
  CustomerDashboardDto,
} from './dto/dashboard.dto';

/**
 * Aggregate metrics, scoped to the actor.
 *
 * A runner sees their own customers, a manager their chain, a master the
 * whole business — the same endpoint, different data. The scope predicate
 * is resolved once and reused across every aggregate, so no two figures on
 * the page can be computed against different visibility.
 */
@ApiTags('Dashboard')
@Controller('team/dashboard')
@TeamAuth()
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  @ResponseMessage('Dashboard retrieved successfully')
  @ApiOperation({
    summary: 'Scoped overview metrics',
    description: [
      'All-time net (in, out, balance), this month with the change against last month,',
      'top games by debit and by credit, customer and VIP counts, messaging counters,',
      'and a rollup one level below the actor: per-manager for a master, per-runner for',
      'a manager, empty for a runner.',
      '',
      "Cached briefly per actor. The cache key includes the actor id, so one chain's",
      'figures can never be served to another.',
    ].join(' '),
  })
  @ApiOkData(DashboardResponseDto)
  @ApiErrors(401, 404, 422)
  getDashboard(
    @CurrentStaff() actor: ICurrentStaff,
    @Query() filters: DashboardFilterDto,
  ): Promise<DashboardResponseDto> {
    return this.dashboardService.getDashboard(actor, filters);
  }

  @Get('trends')
  @ResponseMessage('Trends retrieved successfully')
  @ApiOperation({
    summary: 'Time-bucketed net series',
    description:
      'Gap-filled: buckets with no activity return zeros rather than being omitted, so a chart shows a flat line instead of joining across the gap and implying activity that never happened.',
  })
  @ApiOkData(TrendResponseDto)
  @ApiErrors(401, 404, 422)
  getTrends(
    @CurrentStaff() actor: ICurrentStaff,
    @Query() query: TrendQueryDto,
  ): Promise<TrendResponseDto> {
    return this.dashboardService.getTrends(actor, query);
  }
}

/** The customer's own overview. */
@ApiTags('Customer Portal')
@Controller('me')
export class CustomerDashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('dashboard')
  @CustomerAuth()
  @ResponseMessage('Dashboard retrieved successfully')
  @ApiOperation({
    summary: "The signed-in customer's own overview",
    description:
      'Balance, bonus balance, lifetime spend and withdrawals, VIP standing, unread replies and spin wins. `totalWithdrawn` excludes corrections, so it is money actually taken out.',
  })
  @ApiOkData(CustomerDashboardDto)
  @ApiErrors(401)
  getCustomerDashboard(@CurrentCustomer() actor: ICurrentCustomer): Promise<CustomerDashboardDto> {
    return this.dashboardService.getCustomerDashboard(actor.id);
  }
}
