-- EXPANDIR: se agrega la entidad relacionada antes de retirar la columna antigua.
CREATE TABLE "OrderItem" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPriceCents" INTEGER NOT NULL,
    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "OrderItem_quantity_check" CHECK ("quantity" > 0),
    CONSTRAINT "OrderItem_unitPriceCents_check" CHECK ("unitPriceCents" >= 0)
);

CREATE UNIQUE INDEX "OrderItem_orderId_productId_key"
ON "OrderItem"("orderId", "productId");

ALTER TABLE "OrderItem"
ADD CONSTRAINT "OrderItem_orderId_fkey"
FOREIGN KEY ("orderId") REFERENCES "Order"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrderItem"
ADD CONSTRAINT "OrderItem_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "Product"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- MIGRAR: producto técnico e ítem equivalente para cada pedido histórico.
-- El ON CONFLICT permite reintentos seguros del paso de datos.
INSERT INTO "Product" ("sku", "name", "priceCents", "stock")
VALUES ('LEGACY-MIGRATION', 'Producto histórico migrado', 0, 0)
ON CONFLICT ("sku") DO NOTHING;

INSERT INTO "OrderItem" ("orderId", "productId", "quantity", "unitPriceCents")
SELECT o."id", p."id", 1, o."totalCents"
FROM "Order" o
CROSS JOIN "Product" p
WHERE p."sku" = 'LEGACY-MIGRATION'
  AND NOT EXISTS (
      SELECT 1 FROM "OrderItem" i WHERE i."orderId" = o."id"
  );

-- Validación defensiva: aborta la migración si algún pedido quedó sin detalle.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "Order" o
    WHERE NOT EXISTS (SELECT 1 FROM "OrderItem" i WHERE i."orderId" = o."id")
  ) THEN
    RAISE EXCEPTION 'No se migraron todos los pedidos históricos';
  END IF;
END $$;

-- CONTRAER: el total deja de duplicarse; ahora se calcula desde los detalles.
ALTER TABLE "Order" DROP COLUMN "totalCents";
