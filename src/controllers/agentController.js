import prisma from "../config/prisma.js";
import bcrypt from "bcryptjs";
export const registerAsAgent = async (req, res) => {
  try {
    const { assignedRegion, commissionRate, bio } = req.body;

    if (!assignedRegion || !commissionRate) {
      return res
        .status(400)
        .json({ message: "assignedRegion and commissionRate are required" });
    }

    // Check if already an agent
    const existing = await prisma.fieldAgent.findUnique({
      where: { userId: req.user.id },
    });
    if (existing) {
      return res
        .status(409)
        .json({ message: "You are already registered as a field agent" });
    }

    const agent = await prisma.fieldAgent.create({
      data: {
        assignedRegion,
        commissionRate: parseFloat(commissionRate),
        bio,
        userId: req.user.id,
      },
      include: {
        user: { select: { id: true, fullName: true, email: true, role: true } },
      },
    });

    return res
      .status(201)
      .json({ message: "Registered as field agent successfully", agent });
  } catch (error) {
    console.error("Register agent error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const registerFarmerAsAgent = async (req, res) => {
  try {
    const { fullName, email, password, phoneNumber, region } = req.body;

    if (!fullName || !email || !password) {
      return res
        .status(400)
        .json({ message: "fullName, email and password are required" });
    }

    if (password.length < 8 || !/\d/.test(password)) {
      return res
        .status(400)
        .json({
          message:
            "Password must be at least 8 characters and contain at least one number",
        });
    }

    // Check for required KYC documents
    if (
      !req.files?.nationalId?.[0] ||
      !req.files?.farmRegistration?.[0] ||
      !req.files?.businessCertificate?.[0]
    ) {
      return res.status(400).json({
        message:
          "All three KYC documents are required: National ID, Farm Registration, and Business Certificate",
      });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ message: "Email already exists" });
    }

    // Get agent profile
    const agentProfile = await prisma.fieldAgent.findUnique({
      where: { userId: req.user.id },
    });
    if (!agentProfile) {
      return res.status(404).json({ message: "Agent profile not found" });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const farmer = await prisma.user.create({
      data: {
        fullName,
        email,
        passwordHash: hashedPassword,
        phoneNumber,
        region,
        nationalIdImageUrl: req.files.nationalId[0].path,
        farmRegistrationImageUrl: req.files.farmRegistration[0].path,
        businessCertificateImageUrl: req.files.businessCertificate[0].path,
        kycStatus: "PENDING",
        kycSubmittedAt: new Date(),
        role: "FARMER",
        isVerified: true, // agent-registered farmers are pre-verified for email
        agentId: agentProfile.id,
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        region: true,
        isVerified: true,
        kycStatus: true,
      },
    });

    return res
      .status(201)
      .json({
        message:
          "Farmer registered successfully. KYC documents pending admin approval.",
        farmer,
      });
  } catch (error) {
    console.error("Register farmer as agent error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getMyFarmers = async (req, res) => {
  try {
    const agentProfile = await prisma.fieldAgent.findUnique({
      where: { userId: req.user.id },
    });
    if (!agentProfile) {
      return res.status(404).json({ message: "Agent profile not found" });
    }

    const farmers = await prisma.user.findMany({
      where: { agentId: agentProfile.id },
      select: {
        id: true,
        fullName: true,
        email: true,
        phoneNumber: true,
        region: true,
        isVerified: true,
        isActive: true,
        createdAt: true,
        listings: {
          select: {
            id: true,
            title: true,
            status: true,
            pricePerUnit: true,
            quantityAvailable: true,
            unit: true,
          },
        },
      },
    });

    return res.status(200).json({ farmers });
  } catch (error) {
    console.error("Get my farmers error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const requestAgent = async (req, res) => {
  try {
    const { agentId } = req.params;

    const agentProfile = await prisma.fieldAgent.findUnique({
      where: { id: agentId },
    });
    if (!agentProfile) {
      return res.status(404).json({ message: "Agent not found" });
    }

    // Check if farmer already has an agent
    const farmer = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (farmer.agentId) {
      return res
        .status(400)
        .json({ message: "You already have an agent managing your account" });
    }

    // Check for existing pending request
    const existing = await prisma.agentRequest.findUnique({
      where: { farmerId_agentId: { farmerId: req.user.id, agentId } },
    });
    if (existing) {
      return res
        .status(409)
        .json({
          message: "You already have a pending request with this agent",
        });
    }

    const request = await prisma.agentRequest.create({
      data: {
        farmerId: req.user.id,
        agentId,
      },
      include: {
        farmer: { select: { id: true, fullName: true } },
        agent: { include: { user: { select: { id: true, fullName: true } } } },
      },
    });

    return res.status(201).json({ message: "Agent request sent", request });
  } catch (error) {
    console.error("Request agent error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const handleAgentRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { status } = req.body;

    if (!["ACCEPTED", "REJECTED"].includes(status)) {
      return res
        .status(400)
        .json({ message: "Status must be ACCEPTED or REJECTED" });
    }

    const agentProfile = await prisma.fieldAgent.findUnique({
      where: { userId: req.user.id },
    });
    if (!agentProfile) {
      return res.status(404).json({ message: "Agent profile not found" });
    }

    const request = await prisma.agentRequest.findUnique({
      where: { id: requestId },
    });
    if (!request) {
      return res.status(404).json({ message: "Request not found" });
    }

    if (request.agentId !== agentProfile.id) {
      return res.status(403).json({ message: "This request is not for you" });
    }

    if (request.status !== "PENDING") {
      return res
        .status(400)
        .json({ message: "This request has already been resolved" });
    }

    await prisma.agentRequest.update({
      where: { id: requestId },
      data: { status },
    });

    // If accepted, link farmer to agent
    if (status === "ACCEPTED") {
      await prisma.user.update({
        where: { id: request.farmerId },
        data: { agentId: agentProfile.id },
      });
    }

    return res.status(200).json({ message: `Request ${status.toLowerCase()}` });
  } catch (error) {
    console.error("Handle agent request error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getAgentRequests = async (req, res) => {
  try {
    const agentProfile = await prisma.fieldAgent.findUnique({
      where: { userId: req.user.id },
    });
    if (!agentProfile) {
      return res.status(404).json({ message: "Agent profile not found" });
    }

    const requests = await prisma.agentRequest.findMany({
      where: { agentId: agentProfile.id },
      include: {
        farmer: {
          select: { id: true, fullName: true, email: true, region: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return res.status(200).json({ requests });
  } catch (error) {
    console.error("Get agent requests error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getAllAgents = async (req, res) => {
  try {
    const { region, page = 1, limit = 20 } = req.query;

    const filters = { isActive: true };
    if (region)
      filters.assignedRegion = { contains: region, mode: "insensitive" };

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [agents, total] = await Promise.all([
      prisma.fieldAgent.findMany({
        where: filters,
        include: {
          user: {
            select: { id: true, fullName: true, email: true, region: true },
          },
        },
        orderBy: { ratingAvg: "desc" },
        skip,
        take: parseInt(limit),
      }),
      prisma.fieldAgent.count({ where: filters }),
    ]);

    return res.status(200).json({
      agents,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Get agents error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getAgentById = async (req, res) => {
  try {
    const { id } = req.params;

    const agent = await prisma.fieldAgent.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, fullName: true, email: true, region: true },
        },
      },
    });

    if (!agent) {
      return res.status(404).json({ message: "Agent not found" });
    }

    return res.status(200).json({ agent });
  } catch (error) {
    console.error("Get agent error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const assignAgentToOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { agentId } = req.body;

    if (!agentId) {
      return res.status(400).json({ message: "agentId is required" });
    }

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    const agent = await prisma.fieldAgent.findUnique({
      where: { id: agentId },
      include: { user: true },
    });
    if (!agent) {
      return res.status(404).json({ message: "Agent not found" });
    }

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: { agentId: agent.userId },
      include: {
        agent: { select: { id: true, fullName: true } },
      },
    });

    // Increment agent's total orders handled
    await prisma.fieldAgent.update({
      where: { id: agentId },
      data: { totalOrdersHandled: { increment: 1 } },
    });

    return res
      .status(200)
      .json({ message: "Agent assigned to order", order: updated });
  } catch (error) {
    console.error("Assign agent error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
