import prisma from "../config/prisma.js";

// OWASP A03 – Injection: only these payment methods are accepted.
// Adding a new method requires an explicit code change, not a user-supplied string.
const ALLOWED_PAYMENT_METHODS = new Set(["PAYSTACK", "CASH_ON_DELIVERY"]);

// Allow-list for order status filter in getMyOrders
const ALLOWED_ORDER_STATUSES = new Set([
  "PENDING", "CONFIRMED", "DISPATCHED", "DELIVERED", "CANCELLED",
]);

export const createOrder = async (req, res) => {
  try {
    const { paymentMethod, deliveryAddress, notes } = req.body;

    if (!paymentMethod) {
      return res.status(400).json({ message: "paymentMethod is required" });
    }

    // Validate payment method against allow-list (OWASP A03)
    const normalizedMethod = String(paymentMethod).trim().toUpperCase();
    if (!ALLOWED_PAYMENT_METHODS.has(normalizedMethod)) {
      return res.status(400).json({
        message: `paymentMethod must be one of: ${[...ALLOWED_PAYMENT_METHODS].join(", ")}`,
      });
    }

    // Enforce field length limits to prevent oversized DB writes (OWASP A04)
    if (deliveryAddress && String(deliveryAddress).length > 300) {
      return res.status(400).json({ message: "deliveryAddress must be at most 300 characters" });
    }
    if (notes && String(notes).length > 500) {
      return res.status(400).json({ message: "notes must be at most 500 characters" });
    }

    const cart = await prisma.cart.findUnique({
      where: { userId: req.user.id },
      include: { items: { include: { listing: true } } },
    });

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ message: "Your cart is empty" });
    }

    // Validate all items
    const issues = [];
    let totalPrice = 0;
    const orderItems = [];

    for (const item of cart.items) {
      const listing = item.listing;

      if (listing.status !== "ACTIVE") {
        issues.push({ title: listing.title, issue: "No longer available" });
        continue;
      }

      if (parseFloat(listing.quantityAvailable) < parseFloat(item.quantity)) {
        issues.push({
          title: listing.title,
          issue: `Only ${listing.quantityAvailable} ${listing.unit} available`,
        });
        continue;
      }

      const unitPrice = parseFloat(listing.pricePerUnit);
      const quantity = parseFloat(item.quantity);
      const itemTotal = unitPrice * quantity;

      totalPrice += itemTotal;
      orderItems.push({
        listingId: listing.id,
        quantityOrdered: quantity,
        unitPriceAtOrder: unitPrice,
        totalPrice: itemTotal,
      });
    }

    if (issues.length > 0) {
      return res
        .status(400)
        .json({ message: "Some items in your cart have issues", issues });
    }

    // Create order + order items + reduce stock + clear cart in one transaction
    const order = await prisma.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          totalPrice,
          paymentMethod,
          deliveryAddress,
          notes,
          buyerId: req.user.id,
          items: { create: orderItems },
        },
        include: {
          items: {
            include: {
              listing: { select: { id: true, title: true, unit: true } },
            },
          },
        },
      });

      // Reduce quantityAvailable for each listing
      for (const item of orderItems) {
        await tx.listing.update({
          where: { id: item.listingId },
          data: { quantityAvailable: { decrement: item.quantityOrdered } },
        });
      }

      // Clear cart
      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

      return newOrder;
    });

    return res
      .status(201)
      .json({ message: "Order placed successfully", order });
  } catch (error) {
    console.error("Create order error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getMyOrders = async (req, res) => {
  try {
    const { role, id } = req.user;
    const { status, page = 1, limit = 20 } = req.query;

    const filters = {};
    if (role === "BUYER") filters.buyerId = id;
    else if (role === "FARMER" || role === "AGENT") {
      filters.items = { some: { listing: { sellerId: id } } };
    }

    // Validate status query param against allow-list to prevent unexpected filter values
    if (status) {
      const normalizedStatus = String(status).trim().toUpperCase();
      if (ALLOWED_ORDER_STATUSES.has(normalizedStatus)) {
        filters.status = normalizedStatus;
      }
      // Silently ignore invalid status values rather than erroring — keeps the
      // endpoint resilient to stale client code sending old status strings.
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where: filters,
        include: {
          items: {
            include: {
              listing: { select: { id: true, title: true, unit: true } },
            },
          },
          buyer: { select: { id: true, fullName: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: parseInt(limit),
      }),
      prisma.order.count({ where: filters }),
    ]);

    return res.status(200).json({
      orders,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Get orders error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            listing: {
              select: {
                id: true,
                title: true,
                unit: true,
                pricePerUnit: true,
                seller: { select: { id: true, fullName: true } },
              },
            },
          },
        },
        buyer: { select: { id: true, fullName: true, email: true } },
        agent: { select: { id: true, fullName: true } },
        payment: true,
      },
    });

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    const isBuyer = order.buyerId === req.user.id;
    const isSeller = order.items.some(
      (item) => item.listing.seller.id === req.user.id,
    );
    const isAgent = order.agentId === req.user.id;
    const isAdmin = req.user.role === "ADMIN";

    if (!isBuyer && !isSeller && !isAgent && !isAdmin) {
      return res
        .status(403)
        .json({ message: "You do not have access to this order" });
    }

    return res.status(200).json({ order });
  } catch (error) {
    console.error("Get order error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ message: "Status is required" });
    }

    const order = await prisma.order.findUnique({
      where: { id },
      include: { items: { include: { listing: true } } },
    });

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    const isSeller = order.items.some(
      (item) => item.listing.sellerId === req.user.id,
    );
    const isBuyer = order.buyerId === req.user.id;
    const isAgent = order.agentId === req.user.id;

    const sellerAllowed = ["CONFIRMED", "DISPATCHED", "DELIVERED", "CANCELLED"];
    const buyerAllowed = ["CANCELLED"];

    if (isSeller || isAgent) {
      if (!sellerAllowed.includes(status)) {
        return res
          .status(400)
          .json({
            message: `Farmer can only set status to: ${sellerAllowed.join(", ")}`,
          });
      }
    } else if (isBuyer) {
      if (!buyerAllowed.includes(status)) {
        return res
          .status(400)
          .json({ message: "Buyers can only cancel orders" });
      }
      if (order.status !== "PENDING") {
        return res
          .status(400)
          .json({ message: "You can only cancel a pending order" });
      }
    } else {
      return res
        .status(403)
        .json({ message: "You do not have access to this order" });
    }

    if (status === "CANCELLED" && order.status !== "CANCELLED") {
      await prisma.$transaction(async (tx) => {
        await tx.order.update({
          where: { id },
          data: { status, deliveredAt: null },
        });
        for (const item of order.items) {
          await tx.listing.update({
            where: { id: item.listingId },
            data: {
              quantityAvailable: {
                increment: parseFloat(item.quantityOrdered),
              },
            },
          });
        }
      });
    } else {
      await prisma.order.update({
        where: { id },
        data: {
          status,
          deliveredAt: status === "DELIVERED" ? new Date() : null,
        },
      });
    }

    return res
      .status(200)
      .json({ message: `Order status updated to ${status}` });
  } catch (error) {
    console.error("Update order status error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
