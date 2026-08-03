import { Module } from '@nestjs/common';
import {
  ReferralProgramsController,
  ReferralsController,
  PublicReferralController,
  MyReferralController,
} from './referrals.controller';
import { ReferralsService } from './referrals.service';
import { ReferralRewardService } from './referral-reward.service';

/**
 * ReferralsService is exported so the customers module can attach a
 * referral at signup, keeping code redemption in one place.
 */
@Module({
  controllers: [
    ReferralProgramsController,
    ReferralsController,
    PublicReferralController,
    MyReferralController,
  ],
  providers: [ReferralsService, ReferralRewardService],
  exports: [ReferralsService, ReferralRewardService],
})
export class ReferralsModule {}
