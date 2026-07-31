import { ApiProperty } from '@nestjs/swagger';

export class ApiResponseDto<T> {
  @ApiProperty()
  success!: boolean;

  @ApiProperty()
  message!: string;

  data?: T;

  @ApiProperty({ required: false })
  error?: string;

  @ApiProperty()
  timestamp!: string;

  @ApiProperty()
  correlationId!: string;
}
