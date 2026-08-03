import { Global, Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { JwtTeamStrategy } from './strategies/jwt-team.strategy';
import { JwtCustomerStrategy } from './strategies/jwt-customer.strategy';
import { TokenService } from './token.service';

/**
 * Registers both realm strategies and the token issuer.
 *
 * JwtModule is registered without global sign options on purpose:
 * TokenService signs each token explicitly with the secret and lifetime
 * belonging to its realm, so there is no ambient default that could sign a
 * customer token with the team secret.
 */
@Global()
@Module({
  imports: [PassportModule, JwtModule.register({})],
  providers: [JwtTeamStrategy, JwtCustomerStrategy, TokenService],
  exports: [PassportModule, JwtModule, TokenService],
})
export class SharedAuthModule {}
