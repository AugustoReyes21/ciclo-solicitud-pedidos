import { Controller, Get, Module } from '@nestjs/common';
import { OrdersModule } from './orders/orders.module';

@Controller()
class HealthController {
  @Get('health')
  health() {
    return { status: 'ok' };
  }
}

@Module({ imports: [OrdersModule], controllers: [HealthController] })
export class AppModule {}
