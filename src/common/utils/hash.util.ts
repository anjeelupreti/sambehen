import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class HashUtil {
  /**
   * Helper utility containing basic cryptographic/hashing procedures.
   */
  static hashSha256(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  static generateRandomToken(length = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }
}
