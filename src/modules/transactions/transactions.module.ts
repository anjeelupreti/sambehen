import { Module } from '@nestjs/common';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';
import { TransactionRepository } from '@database/repositories/transaction.repository';
import { GameRepository } from '@database/repositories/game.repository';

@Module({
  controllers: [TransactionsController],
  providers: [TransactionsService, TransactionRepository, GameRepository],
  exports: [TransactionsService, TransactionRepository],
})
export class TransactionsModule {}
