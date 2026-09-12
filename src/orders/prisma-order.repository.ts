import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DomainError } from '../common/domain.error';
import { PrismaService } from '../database/prisma.service';
import { NewOrder, OrderRepository } from './order.repository';

@Injectable()
export class PrismaOrderRepository implements OrderRepository {
  constructor(private readonly prisma: PrismaService) {}

  async customerExists(id: number) {
    return (await this.prisma.customer.count({ where: { id } })) === 1;
  }

  findProducts(ids: number[]) {
    return this.prisma.product.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, priceCents: true, stock: true },
    });
  }

  async externalCodeExists(code: string) {
    return (
      (await this.prisma.order.count({ where: { externalCode: code } })) > 0
    );
  }

  async create(data: NewOrder) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        for (const item of data.items) {
          const updated = await tx.product.updateMany({
            where: { id: item.productId, stock: { gte: item.quantity } },
            data: { stock: { decrement: item.quantity } },
          });
          if (updated.count !== 1) {
            throw new DomainError(
              'STOCK_CHANGED',
              'El stock cambió durante la operación; intente de nuevo',
              409,
            );
          }
        }

        const order = await tx.order.create({
          data: {
            customerId: data.customerId,
            externalCode: data.externalCode,
            items: { create: data.items },
          },
          include: { customer: true, items: { include: { product: true } } },
        });

        return {
          ...order,
          totalCents: order.items.reduce(
            (sum, item) => sum + item.quantity * item.unitPriceCents,
            0,
          ),
        };
      });
    } catch (error) {
      if (error instanceof DomainError) throw error;
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new DomainError(
          'DATABASE_CONFLICT',
          'La base de datos rechazó un valor duplicado',
          409,
        );
      }
      throw error;
    }
  }

  async list() {
    const orders = await this.prisma.order.findMany({
      include: { customer: true, items: { include: { product: true } } },
      orderBy: { id: 'asc' },
    });
    return orders.map((order) => ({
      ...order,
      totalCents: order.items.reduce(
        (sum, item) => sum + item.quantity * item.unitPriceCents,
        0,
      ),
    }));
  }
}
