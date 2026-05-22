import prisma from "../config/prisma.js";
import { pushEvent } from "../config/pusher.js";
import { createNegotiationNotification } from "./notificationController.js";
import { sendNegotiationUpdateEmail } from "../services/emailService.js";

/**
 * POST /api/negotiations
 * Buyer proposes a price offer on a negotiable listing.
 * Body: { listingId, offeredPrice, quantity?, note?, conversationId? }
 */
export const makeOffer = async (req, res) => {
  const proposerId = req.user.id;
  const { listingId, offeredPrice, quantity, note, conversationId } = req.body;

  if (!listingId)
    return res.status(400).json({ message: "listingId is required" });
  const price = parseFloat(offeredPrice);
  if (!offeredPrice || isNaN(price) || price <= 0)
    return res
      .status(400)
      .json({ message: "offeredPrice must be a positive number" });

  try {
    const listing = await prisma.listing.findUnique({
      where: { id: listingId },
      include: {
        seller: { select: { id: true, email: true, fullName: true } },
      },
    });
    if (!listing) return res.status(404).json({ message: "Listing not found" });
    if (listing.status !== "ACTIVE")
      return res
        .status(400)
        .json({ message: "Cannot make an offer on a non-active listing" });
    if (listing.sellerId === proposerId)
      return res
        .status(400)
        .json({ message: "Cannot make an offer on your own listing" });

    const offer = await prisma.negotiationOffer.create({
      data: {
        proposerId,
        listingId,
        offeredPrice: price,
        quantity: quantity ? parseFloat(quantity) : null,
        note: note?.trim() ?? null,
        conversationId: conversationId ?? null,
      },
      include: {
        proposer: { select: { id: true, fullName: true } },
        listing: {
          select: { id: true, title: true, pricePerUnit: true, unit: true },
        },
      },
    });

    const sellerId = listing.sellerId;

    // Pusher push to seller
    await pushEvent(`private-user-${sellerId}`, "new-offer", { offer });

    // In-app notification for seller
    createNegotiationNotification({
      receiverId: sellerId,
      senderName: offer.proposer.fullName,
      offerStatus: "PENDING",
      offerId: offer.id,
      listingTitle: listing.title,
    }).catch(() => {});

    // Email notification for seller (fire-and-forget)
    if (listing.seller.email) {
      sendNegotiationUpdateEmail({
        email: listing.seller.email,
        recipientName: listing.seller.fullName,
        senderName: offer.proposer.fullName,
        listingTitle: listing.title,
        status: "PENDING",
        offeredPrice: price,
        note: note ?? null,
      }).catch(() => {});
    }

    res.status(201).json(offer);
  } catch (err) {
    console.error("makeOffer error:", err);
    res.status(500).json({ message: "Failed to create offer" });
  }
};

/**
 * GET /api/negotiations?listingId=&role=buyer|seller
 * Returns offers for a listing or all offers relevant to the user.
 */
export const getOffers = async (req, res) => {
  const userId = req.user.id;
  const { listingId, role } = req.query;

  const where = listingId
    ? { listingId }
    : role === "seller"
      ? { listing: { sellerId: userId } }
      : { proposerId: userId };

  try {
    const offers = await prisma.negotiationOffer.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        proposer: {
          select: { id: true, fullName: true, profilePhotoUrl: true },
        },
        listing: {
          select: {
            id: true,
            title: true,
            pricePerUnit: true,
            unit: true,
            seller: { select: { id: true, fullName: true } },
          },
        },
      },
    });
    res.json(offers);
  } catch (err) {
    console.error("getOffers error:", err);
    res.status(500).json({ message: "Failed to fetch offers" });
  }
};

/**
 * PATCH /api/negotiations/:offerId
 * Seller accepts, rejects, or counters. Buyer can withdraw.
 * Body: { status: ACCEPTED|REJECTED|COUNTERED|WITHDRAWN, note? }
 */
export const respondToOffer = async (req, res) => {
  const userId = req.user.id;
  const { offerId } = req.params;
  const { status, note } = req.body;

  const allowed = ["ACCEPTED", "REJECTED", "COUNTERED", "WITHDRAWN"];
  if (!allowed.includes(status))
    return res
      .status(400)
      .json({ message: `status must be one of: ${allowed.join(", ")}` });

  try {
    const offer = await prisma.negotiationOffer.findUnique({
      where: { id: offerId },
      include: {
        proposer: { select: { id: true, email: true, fullName: true } },
        listing: {
          select: {
            id: true,
            title: true,
            sellerId: true,
            seller: { select: { id: true, fullName: true } },
          },
        },
      },
    });
    if (!offer) return res.status(404).json({ message: "Offer not found" });

    const isSeller = offer.listing.sellerId === userId;
    const isProposer = offer.proposerId === userId;

    if (status === "WITHDRAWN" && !isProposer)
      return res
        .status(403)
        .json({ message: "Only the proposer can withdraw an offer" });
    if (["ACCEPTED", "REJECTED", "COUNTERED"].includes(status) && !isSeller)
      return res
        .status(403)
        .json({ message: "Only the seller can respond to an offer" });
    if (offer.status !== "PENDING")
      return res.status(400).json({ message: "Offer is no longer pending" });

    const updated = await prisma.negotiationOffer.update({
      where: { id: offerId },
      data: { status, note: note?.trim() ?? offer.note },
      include: {
        proposer: { select: { id: true, fullName: true } },
        listing: {
          select: { id: true, title: true, pricePerUnit: true, unit: true },
        },
      },
    });

    // Notify the other party
    const notifyId = isProposer ? offer.listing.sellerId : offer.proposerId;
    const senderName = isSeller
      ? offer.listing.seller.fullName
      : offer.proposer.fullName;

    await pushEvent(`private-user-${notifyId}`, "offer-updated", {
      offer: updated,
    });

    createNegotiationNotification({
      receiverId: notifyId,
      senderName,
      offerStatus: status,
      offerId,
      listingTitle: offer.listing.title,
    }).catch(() => {});

    // Email to proposer when seller responds (fire-and-forget)
    if (
      ["ACCEPTED", "REJECTED", "COUNTERED"].includes(status) &&
      offer.proposer.email
    ) {
      sendNegotiationUpdateEmail({
        email: offer.proposer.email,
        recipientName: offer.proposer.fullName,
        senderName: offer.listing.seller.fullName,
        listingTitle: offer.listing.title,
        status,
        offeredPrice: Number(offer.offeredPrice),
        note: note ?? null,
      }).catch(() => {});
    }

    res.json(updated);
  } catch (err) {
    console.error("respondToOffer error:", err);
    res.status(500).json({ message: "Failed to update offer" });
  }
};
