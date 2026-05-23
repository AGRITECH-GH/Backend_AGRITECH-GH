-- Migrate PaymentMethod enum values to match checkout API values.
-- Existing values are remapped:
--   CASH  -> CASH_ON_DELIVERY
--   MOMO  -> PAY_ONLINE
--   BARTER -> CASH_ON_DELIVERY
--   CREDIT -> PAY_ONLINE

ALTER TYPE "PaymentMethod" RENAME TO "PaymentMethod_old";

CREATE TYPE "PaymentMethod" AS ENUM ('CASH_ON_DELIVERY', 'PAY_ONLINE');

ALTER TABLE "Order"
ALTER COLUMN "paymentMethod" TYPE "PaymentMethod"
USING (
  CASE "paymentMethod"::text
    WHEN 'CASH' THEN 'CASH_ON_DELIVERY'
    WHEN 'MOMO' THEN 'PAY_ONLINE'
    WHEN 'BARTER' THEN 'CASH_ON_DELIVERY'
    WHEN 'CREDIT' THEN 'PAY_ONLINE'
    WHEN 'CASH_ON_DELIVERY' THEN 'CASH_ON_DELIVERY'
    WHEN 'PAY_ONLINE' THEN 'PAY_ONLINE'
    ELSE 'CASH_ON_DELIVERY'
  END
)::"PaymentMethod";

ALTER TABLE "Payment"
ALTER COLUMN "method" TYPE "PaymentMethod"
USING (
  CASE "method"::text
    WHEN 'CASH' THEN 'CASH_ON_DELIVERY'
    WHEN 'MOMO' THEN 'PAY_ONLINE'
    WHEN 'BARTER' THEN 'CASH_ON_DELIVERY'
    WHEN 'CREDIT' THEN 'PAY_ONLINE'
    WHEN 'CASH_ON_DELIVERY' THEN 'CASH_ON_DELIVERY'
    WHEN 'PAY_ONLINE' THEN 'PAY_ONLINE'
    ELSE 'CASH_ON_DELIVERY'
  END
)::"PaymentMethod";

DROP TYPE "PaymentMethod_old";
