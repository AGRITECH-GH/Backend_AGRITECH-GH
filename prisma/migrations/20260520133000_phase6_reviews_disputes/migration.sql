-- Phase 6: Reviews + disputes + admin mediation

-- 1) Track actual delivery timestamp on orders (needed for dispute window checks)
ALTER TABLE "Order" ADD COLUMN "deliveredAt" TIMESTAMP(3);

-- 2) Dispute status enum
CREATE TYPE "DisputeStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED');

-- 3) Dispute table (one dispute per order)
CREATE TABLE "Dispute" (
  "id" TEXT NOT NULL,
  "reason" VARCHAR(200) NOT NULL,
  "details" TEXT,
  "evidenceUrls" JSONB,
  "status" "DisputeStatus" NOT NULL DEFAULT 'OPEN',
  "mediationNote" TEXT,
  "resolutionNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "resolvedAt" TIMESTAMP(3),
  "orderId" TEXT NOT NULL,
  "filedById" TEXT NOT NULL,
  "assignedToId" TEXT,
  CONSTRAINT "Dispute_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Dispute_orderId_key" ON "Dispute"("orderId");

ALTER TABLE "Dispute"
  ADD CONSTRAINT "Dispute_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "Dispute_filedById_fkey"
    FOREIGN KEY ("filedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "Dispute_assignedToId_fkey"
    FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 4) Mediation audit trail
CREATE TABLE "DisputeAuditLog" (
  "id" TEXT NOT NULL,
  "action" VARCHAR(100) NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "disputeId" TEXT NOT NULL,
  "adminId" TEXT NOT NULL,
  CONSTRAINT "DisputeAuditLog_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "DisputeAuditLog"
  ADD CONSTRAINT "DisputeAuditLog_disputeId_fkey"
    FOREIGN KEY ("disputeId") REFERENCES "Dispute"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "DisputeAuditLog_adminId_fkey"
    FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 5) Notification type for disputes
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'DISPUTE';
