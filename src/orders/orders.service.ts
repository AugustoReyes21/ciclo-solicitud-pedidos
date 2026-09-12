import { Inject, Injectable } from '@nestjs/common';
import { DomainError } from '../common/domain.error';
import { CreateOrderDto } from './dto/create-order.dto';
import { ORDER_REPOSITORY, OrderRepository } from './order.repository';

@Injectable()
export class OrdersService {
  constructor(
    @Inject(ORDER_REPOSITORY) private readonly repository: OrderRepository,
  ) {}

  async create(input: CreateOrderDto) {
    const productIds = input.items.map((item) => item.productId);
    if (new Set(productIds).size !== productIds.length) {
      throw new DomainError(
        'DUPLICATE_PRODUCT',
        'Cada producto debe aparecer una sola vez en el pedido',
        422,
      );
    }

    const [customerExists, codeExists, products] = await Promise.all([
      this.repository.customerExists(input.customerId),
      this.repository.externalCodeExists(input.externalCode),
      this.repository.findProducts(productIds),
    ]);

    if (!customerExists) {
      throw new DomainError('CUSTOMER_NOT_FOUND', 'El cliente no existe', 404);
    }
    if (codeExists) {
      throw new DomainError(
        'ORDER_CODE_EXISTS',
        'El código externo ya fue utilizado',
        409,
      );
    }
    if (products.length !== productIds.length) {
      const found = new Set(products.map((product) => product.id));
      throw new DomainError(
        'PRODUCT_NOT_FOUND',
        'Uno o más productos no existen',
        404,
        {
          missingProductIds: productIds.filter((id) => !found.has(id)),
        },
      );
    }

    const byId = new Map(products.map((product) => [product.id, product]));
    const items = input.items.map((item) => {
      const product = byId.get(item.productId)!;
      if (item.quantity > product.stock) {
        throw new DomainError(
          'INSUFFICIENT_STOCK',
          `Stock insuficiente para ${product.name}`,
          409,
          { productId: product.id, available: product.stock },
        );
      }
      return { ...item, unitPriceCents: product.priceCents };
    });

    return this.repository.create({
      customerId: input.customerId,
      externalCode: input.externalCode,
      items,
    });
  }

  list() {
    return this.repository.list();
  }
}
