import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { ORDER_REPOSITORY } from './order.repository';
import { OrdersController } from './orders.controller';
import { PrismaOrderRepository } from './prisma-order.repository';
import { OrdersService } from './orders.service';

@Module({
  imports: [DatabaseModule],
  controllers: [OrdersController],
  providers: [
    OrdersService,
    { provide: ORDER_REPOSITORY, useClass: PrismaOrderRepository },
  ],
})
export class OrdersModule {}
