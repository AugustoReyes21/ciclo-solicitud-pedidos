export const ORDER_REPOSITORY = Symbol('ORDER_REPOSITORY');

export type CatalogProduct = {
  id: number;
  name: string;
  priceCents: number;
  stock: number;
};

export type NewOrder = {
  customerId: number;
  externalCode: string;
  items: Array<{
    productId: number;
    quantity: number;
    unitPriceCents: number;
  }>;
};

export interface OrderRepository {
  customerExists(id: number): Promise<boolean>;
  findProducts(ids: number[]): Promise<CatalogProduct[]>;
  externalCodeExists(code: string): Promise<boolean>;
  create(data: NewOrder): Promise<unknown>;
  list(): Promise<unknown[]>;
}
