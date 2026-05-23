import prisma from "../config/prisma.js";
import axios from "axios";
import crypto from "crypto";

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;

// Generate unique payment reference
const generateReference = () => {
  return `AGRI-${Date.now()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
};

export const initializePayment = async (req, res) => {
  try {
    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({ message: "orderId is required" });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        buyer: { select: { id: true, email: true, fullName: true } },
        payment: true,
      },
    });

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (order.buyerId !== req.user.id) {
      return res
        .status(403)
        .json({ message: "You can only pay for your own orders" });
    }

    if (order.status === "CANCELLED") {
      return res
        .status(400)
        .json({ message: "Cannot pay for a cancelled order" });
    }

    if (order.paymentMethod !== "PAY_ONLINE") {
      return res
        .status(400)
        .json({
          message: "Paystack payments are only available for PAY_ONLINE orders",
        });
    }

    // Check if already paid
    if (order.payment && order.payment.status === "SUCCESS") {
      return res
        .status(400)
        .json({ message: "This order has already been paid" });
    }

    // Amount in kobo/pesewas (Paystack uses smallest currency unit)
    const amountInPesewas = Math.round(parseFloat(order.totalPrice) * 100);

    const reference = generateReference();

    // Log payment attempt
    const payment = await prisma.payment.upsert({
      where: { orderId },
      update: {
        paystackReference: reference,
        attemptCount: { increment: 1 },
        ipAddress: req.ip,
        amount: parseFloat(order.totalPrice),
        method: order.paymentMethod,
      },
      create: {
        orderId,
        payerId: req.user.id,
        amount: parseFloat(order.totalPrice),
        currency: "GHS",
        method: order.paymentMethod,
        paystackReference: reference,
        ipAddress: req.ip,
        attemptCount: 1,
      },
    });

    // Call Paystack initialize endpoint
    const paystackResponse = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        email: order.buyer.email,
        amount: amountInPesewas,
        reference,
        currency: "GHS",
        callback_url: process.env.PAYSTACK_CALLBACK_URL,
        metadata: {
          orderId: order.id,
          buyerId: req.user.id,
          fullName: order.buyer.fullName,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET}`,
          "Content-Type": "application/json",
        },
      },
    );

    return res.status(200).json({
      message: "Payment initialized",
      paymentUrl: paystackResponse.data.data.authorization_url,
      reference,
      amount: parseFloat(order.totalPrice),
      currency: "GHS",
    });
  } catch (error) {
    console.error("Initialize payment error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const verifyPayment = async (req, res) => {
  try {
    const { reference } = req.params;

    if (!reference) {
      return res.status(400).json({ message: "Reference is required" });
    }

    // Find payment by reference
    const payment = await prisma.payment.findUnique({
      where: { paystackReference: reference },
      include: { order: true },
    });

    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }

    if (payment.payerId !== req.user.id) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    if (payment.status === "SUCCESS") {
      return res
        .status(200)
        .json({ message: "Payment already verified", payment });
    }

    // Verify with Paystack
    const paystackResponse = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` },
      },
    );

    const { status, amount, currency } = paystackResponse.data.data;

    if (status === "success") {
      // Verify amount matches — security check
      const expectedAmount = Math.round(parseFloat(payment.amount) * 100);
      if (amount !== expectedAmount) {
        console.error(
          `Amount mismatch: expected ${expectedAmount}, got ${amount}`,
        );
        return res.status(400).json({ message: "Payment amount mismatch" });
      }

      // Update payment and order in one transaction
      await prisma.$transaction([
        prisma.payment.update({
          where: { paystackReference: reference },
          data: {
            status: "SUCCESS",
            paidAt: new Date(),
            paystackResponse: paystackResponse.data.data,
            transactionRef: paystackResponse.data.data.id.toString(),
          },
        }),
        prisma.order.update({
          where: { id: payment.orderId },
          data: { status: "CONFIRMED" },
        }),
      ]);

      return res
        .status(200)
        .json({ message: "Payment verified successfully", status: "SUCCESS" });
    } else {
      await prisma.payment.update({
        where: { paystackReference: reference },
        data: {
          status: "FAILED",
          paystackResponse: paystackResponse.data.data,
        },
      });
      return res.status(400).json({ message: "Payment failed", status });
    }
  } catch (error) {
    console.error("Verify payment error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const paystackWebhook = async (req, res) => {
  try {
    // Verify webhook signature
    const hash = crypto
      .createHmac("sha512", PAYSTACK_SECRET)
      .update(JSON.stringify(req.body))
      .digest("hex");

    if (hash !== req.headers["x-paystack-signature"]) {
      console.error("Invalid webhook signature");
      return res.status(401).json({ message: "Invalid signature" });
    }

    const { event, data } = req.body;

    if (event === "charge.success") {
      const { reference, amount, status } = data;

      const payment = await prisma.payment.findUnique({
        where: { paystackReference: reference },
      });

      if (!payment) {
        console.error(`Webhook: payment not found for reference ${reference}`);
        return res.status(200).json({ message: "OK" }); // Always return 200 to Paystack
      }

      if (payment.status === "SUCCESS") {
        return res.status(200).json({ message: "OK" }); // Already processed
      }

      // Verify amount
      const expectedAmount = Math.round(parseFloat(payment.amount) * 100);
      if (amount !== expectedAmount) {
        console.error(
          `Webhook amount mismatch: expected ${expectedAmount}, got ${amount}`,
        );
        return res.status(200).json({ message: "OK" });
      }

      await prisma.$transaction([
        prisma.payment.update({
          where: { paystackReference: reference },
          data: {
            status: "SUCCESS",
            paidAt: new Date(),
            paystackResponse: data,
            transactionRef: data.id.toString(),
          },
        }),
        prisma.order.update({
          where: { id: payment.orderId },
          data: { status: "CONFIRMED" },
        }),
      ]);

      console.log(`Payment completed via webhook: ${reference}`);
    }

    // Always return 200 to Paystack immediately
    return res.status(200).json({ message: "OK" });
  } catch (error) {
    console.error("Webhook error:", error);
    return res.status(200).json({ message: "OK" }); // Always 200 to prevent Paystack retries
  }
};

export const getPaymentStatus = async (req, res) => {
  try {
    const { orderId } = req.params;

    const payment = await prisma.payment.findUnique({
      where: { orderId },
      select: {
        id: true,
        amount: true,
        currency: true,
        status: true,
        method: true,
        paidAt: true,
        paystackReference: true,
        createdAt: true,
      },
    });

    if (!payment) {
      return res
        .status(404)
        .json({ message: "No payment found for this order" });
    }

    return res.status(200).json({ payment });
  } catch (error) {
    console.error("Get payment status error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
