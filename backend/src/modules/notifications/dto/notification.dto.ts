import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class NotificationDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  kind!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty({ type: String, nullable: true })
  body!: string | null;

  @ApiProperty({ type: String, nullable: true })
  link!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  readAt!: Date | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;
}

export class NotificationListDto {
  @ApiProperty({ type: [NotificationDto] })
  items!: NotificationDto[];

  @ApiProperty()
  unread!: number;
}

export class MarkNotificationsReadDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Leave out to mark everything read.' })
  @IsOptional()
  @IsUUID('4')
  id?: string;
}

export class SetPreferenceDto {
  @ApiProperty()
  @IsString()
  @MaxLength(40)
  kind!: string;

  @ApiProperty()
  @IsBoolean()
  enabled!: boolean;
}

class PushKeysDto {
  @ApiProperty()
  @IsString()
  @MaxLength(200)
  p256dh!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(100)
  auth!: string;
}

export class PushSubscriptionDto {
  @ApiProperty()
  @IsString()
  @MaxLength(1000)
  endpoint!: string;

  @ApiProperty({ type: PushKeysDto })
  @ValidateNested()
  @Type(() => PushKeysDto)
  keys!: PushKeysDto;
}

export class PushUnsubscribeDto {
  @ApiProperty()
  @IsString()
  @MaxLength(1000)
  endpoint!: string;
}

export class PushConfigDto {
  @ApiProperty({
    type: String,
    nullable: true,
    description: 'VAPID public key; null when push is off.',
  })
  publicKey!: string | null;
}
