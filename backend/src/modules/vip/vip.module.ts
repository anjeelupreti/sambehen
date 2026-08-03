import { Module } from '@nestjs/common';
import { VipCriteriaController, VipsController, VipPortalController } from './vip.controller';
import { VipService } from './vip.service';
import { VipQualificationService } from './vip-qualification.service';
import { VipDriftJob } from './vip-drift.job';

/**
 * VipQualificationService is exported because the spins module (phase 5)
 * must check eligibility against the same rules, rather than re-deriving
 * who qualifies.
 */
@Module({
  controllers: [VipCriteriaController, VipsController, VipPortalController],
  providers: [VipService, VipQualificationService, VipDriftJob],
  exports: [VipService, VipQualificationService],
})
export class VipModule {}
