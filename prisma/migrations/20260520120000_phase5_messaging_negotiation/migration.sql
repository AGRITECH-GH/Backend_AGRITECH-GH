-- Phase 5: Messaging, Negotiation Offers, Message Attachments

-- 1. Conversation table (groups messages between two users, optionally tied to a listing)
CREATE TABLE "Conversation" (
  "id"             TEXT NOT NULL,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  "lastMessageAt"  TIMESTAMP(3),
  "participantAId" TEXT NOT NULL,
  "participantBId" TEXT NOT NULL,
  "listingId"      TEXT,
  CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Conversation_participantAId_participantBId_listingId_key"
  ON "Conversation"("participantAId", "participantBId", "listingId");

ALTER TABLE "Conversation"
  ADD CONSTRAINT "Conversation_participantAId_fkey"
    FOREIGN KEY ("participantAId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "Conversation_participantBId_fkey"
    FOREIGN KEY ("participantBId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "Conversation_listingId_fkey"
    FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 2. Add conversationId to existing Message table
ALTER TABLE "Message" ADD COLUMN "conversationId" TEXT;

ALTER TABLE "Message"
  ADD CONSTRAINT "Message_conversationId_fkey"
    FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 3. MessageAttachment table
CREATE TABLE "MessageAttachment" (
  "id"        TEXT NOT NULL,
  "imageUrl"  VARCHAR(500) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "messageId" TEXT NOT NULL,
  CONSTRAINT "MessageAttachment_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "MessageAttachment"
  ADD CONSTRAINT "MessageAttachment_messageId_fkey"
    FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 4. NegotiationStatus enum
CREATE TYPE "NegotiationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'COUNTERED', 'WITHDRAWN');

-- 5. NegotiationOffer table
CREATE TABLE "NegotiationOffer" (
  "id"             TEXT NOT NULL,
  "offeredPrice"   DECIMAL(12,2) NOT NULL,
  "quantity"       DECIMAL(10,2),
  "note"           TEXT,
  "status"         "NegotiationStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  "proposerId"     TEXT NOT NULL,
  "listingId"      TEXT NOT NULL,
  "conversationId" TEXT,
  CONSTRAINT "NegotiationOffer_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "NegotiationOffer"
  ADD CONSTRAINT "NegotiationOffer_proposerId_fkey"
    FOREIGN KEY ("proposerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "NegotiationOffer_listingId_fkey"
    FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "NegotiationOffer_conversationId_fkey"
    FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 6. Add NEGOTIATION to NotificationType enum
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'NEGOTIATION';
