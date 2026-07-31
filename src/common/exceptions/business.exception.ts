import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Custom base exception class for logical domain / business validation errors.
 */
export class BusinessException extends HttpException {
  constructor(message: string, status: HttpStatus = HttpStatus.BAD_REQUEST) {
    super(
      {
        success: false,
        message,
        error: 'BusinessException',
      },
      status,
    );
  }
}
