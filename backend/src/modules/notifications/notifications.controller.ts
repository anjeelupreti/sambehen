import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentCustomer, CurrentStaff } from '@common/decorators/auth.decorators';
import { CustomerAuth, TeamAuth } from '@common/decorators/composite-auth.decorator';
import { ResponseMessage } from '@common/decorators/response-message.decorator';
import { ICurrentCustomer, ICurrentStaff } from '@common/interfaces/auth.interface';
import { ApiErrors, ApiOkData, ApiOkMessage } from '@common/swagger/api-response.decorators';
import {
  MarkNotificationsReadDto,
  NotificationListDto,
  PushConfigDto,
  PushSubscriptionDto,
  PushUnsubscribeDto,
  SetPreferenceDto,
} from './dto/notification.dto';
import { NotificationsService } from './notifications.service';

/**
 * The bell, settings and push subscription endpoints. Staff and players
 * get the same set under their own prefix and sign-in; each only ever
 * reads and changes their own notifications.
 */
@ApiTags('Notifications')
@Controller('team/notifications')
@TeamAuth()
export class StaffNotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Get()
  @ResponseMessage('Notifications retrieved')
  @ApiOperation({ summary: 'Your latest notifications and unread count' })
  @ApiOkData(NotificationListDto)
  @ApiErrors(401)
  list(@CurrentStaff() actor: ICurrentStaff, @Query('limit') limit?: number) {
    return this.service.list('team', actor.id, Number(limit) || 30);
  }

  @Post('read')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Marked read')
  @ApiOperation({ summary: 'Mark one notification, or all, as read' })
  @ApiOkMessage()
  @ApiErrors(401, 422)
  async markRead(
    @CurrentStaff() actor: ICurrentStaff,
    @Body() dto: MarkNotificationsReadDto,
  ): Promise<void> {
    await this.service.markRead('team', actor.id, dto.id);
  }

  @Get('preferences')
  @ResponseMessage('Preferences retrieved')
  @ApiOperation({ summary: 'Which kinds of notification are on' })
  @ApiOkData(Object)
  @ApiErrors(401)
  preferences(@CurrentStaff() actor: ICurrentStaff) {
    return this.service.preferences('team', actor.id);
  }

  @Put('preferences')
  @ResponseMessage('Preference saved')
  @ApiOperation({ summary: 'Turn one kind of notification on or off' })
  @ApiOkData(Object)
  @ApiErrors(401, 422)
  setPreference(@CurrentStaff() actor: ICurrentStaff, @Body() dto: SetPreferenceDto) {
    return this.service.setPreference('team', actor.id, dto.kind, dto.enabled);
  }

  @Get('push')
  @ResponseMessage('Push configuration')
  @ApiOperation({ summary: 'The public key a browser needs to subscribe' })
  @ApiOkData(PushConfigDto)
  @ApiErrors(401)
  pushConfig(): PushConfigDto {
    return { publicKey: this.service.publicKey() };
  }

  @Post('push/subscribe')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Device subscribed')
  @ApiOperation({ summary: 'Allow push notifications on this device' })
  @ApiOkMessage()
  @ApiErrors(401, 422)
  async subscribe(
    @CurrentStaff() actor: ICurrentStaff,
    @Body() dto: PushSubscriptionDto,
    @Headers('user-agent') userAgent?: string,
  ): Promise<void> {
    await this.service.subscribe('team', actor.id, dto, userAgent);
  }

  @Post('push/unsubscribe')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Device unsubscribed')
  @ApiOperation({ summary: 'Stop push notifications on this device' })
  @ApiOkMessage()
  @ApiErrors(401, 422)
  async unsubscribe(
    @CurrentStaff() actor: ICurrentStaff,
    @Body() dto: PushUnsubscribeDto,
  ): Promise<void> {
    await this.service.unsubscribe('team', actor.id, dto.endpoint);
  }
}

@ApiTags('Notifications')
@Controller('me/notifications')
@CustomerAuth()
export class PlayerNotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Get()
  @ResponseMessage('Notifications retrieved')
  @ApiOperation({ summary: 'Your latest notifications and unread count' })
  @ApiOkData(NotificationListDto)
  @ApiErrors(401)
  list(@CurrentCustomer() actor: ICurrentCustomer, @Query('limit') limit?: number) {
    return this.service.list('customer', actor.id, Number(limit) || 30);
  }

  @Post('read')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Marked read')
  @ApiOperation({ summary: 'Mark one notification, or all, as read' })
  @ApiOkMessage()
  @ApiErrors(401, 422)
  async markRead(
    @CurrentCustomer() actor: ICurrentCustomer,
    @Body() dto: MarkNotificationsReadDto,
  ): Promise<void> {
    await this.service.markRead('customer', actor.id, dto.id);
  }

  @Get('preferences')
  @ResponseMessage('Preferences retrieved')
  @ApiOperation({ summary: 'Which kinds of notification are on' })
  @ApiOkData(Object)
  @ApiErrors(401)
  preferences(@CurrentCustomer() actor: ICurrentCustomer) {
    return this.service.preferences('customer', actor.id);
  }

  @Put('preferences')
  @ResponseMessage('Preference saved')
  @ApiOperation({ summary: 'Turn one kind of notification on or off' })
  @ApiOkData(Object)
  @ApiErrors(401, 422)
  setPreference(@CurrentCustomer() actor: ICurrentCustomer, @Body() dto: SetPreferenceDto) {
    return this.service.setPreference('customer', actor.id, dto.kind, dto.enabled);
  }

  @Get('push')
  @ResponseMessage('Push configuration')
  @ApiOperation({ summary: 'The public key a browser needs to subscribe' })
  @ApiOkData(PushConfigDto)
  @ApiErrors(401)
  pushConfig(): PushConfigDto {
    return { publicKey: this.service.publicKey() };
  }

  @Post('push/subscribe')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Device subscribed')
  @ApiOperation({ summary: 'Allow push notifications on this device' })
  @ApiOkMessage()
  @ApiErrors(401, 422)
  async subscribe(
    @CurrentCustomer() actor: ICurrentCustomer,
    @Body() dto: PushSubscriptionDto,
    @Headers('user-agent') userAgent?: string,
  ): Promise<void> {
    await this.service.subscribe('customer', actor.id, dto, userAgent);
  }

  @Post('push/unsubscribe')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Device unsubscribed')
  @ApiOperation({ summary: 'Stop push notifications on this device' })
  @ApiOkMessage()
  @ApiErrors(401, 422)
  async unsubscribe(
    @CurrentCustomer() actor: ICurrentCustomer,
    @Body() dto: PushUnsubscribeDto,
  ): Promise<void> {
    await this.service.unsubscribe('customer', actor.id, dto.endpoint);
  }
}
