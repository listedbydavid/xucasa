import { Router } from "express";
import { z } from "zod";
import { isAuthenticated, isAdmin } from "../authMiddleware";
import { storage } from "../storage";
import { executeWithAudit } from "../auditLog";
import multer from "multer";
import sharp from "sharp";
import path from "path";
import fs from "fs/promises";

const router = Router();
const DAVID_USER_ID = "55534280";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files are allowed"));
  },
});

router.get("/api/vendors", async (req, res) => {
  const category = typeof req.query.category === "string" ? req.query.category : undefined;
  const city = typeof req.query.city === "string" ? req.query.city : undefined;
  const vendors = await storage.listVendors({ category, city, status: "approved" });
  res.json({ vendors });
});

router.get("/api/vendors/:id", async (req, res) => {
  const vendor = await storage.getVendor(Number(req.params.id));
  if (!vendor || vendor.status !== "approved") {
    return res.status(404).json({ message: "Vendor not found" });
  }
  res.json({ vendor });
});

router.post("/api/vendors/apply", upload.single("logo"), async (req: any, res) => {
  const schema = z.object({
    businessName: z.string().min(1).max(100),
    category: z.string().min(1),
    contactName: z.string().min(1),
    email: z.string().email(),
    phone: z.string().optional(),
    website: z.string().url().optional().or(z.literal("")),
    yelpUrl: z.string().url().optional().or(z.literal("")),
    googleBusinessUrl: z.string().url().optional().or(z.literal("")),
    instagramHandle: z.string().max(50).optional(),
    facebookUrl: z.string().url().optional().or(z.literal("")),
    nextdoorUrl: z.string().url().optional().or(z.literal("")),
    description: z.string().max(500).optional(),
    serviceAreaNeighborhoods: z.union([
      z.array(z.string()),
      z.string().transform(s => s.split(",").map(x => x.trim()).filter(Boolean)),
    ]).optional().default([]),
    serviceAreaZips: z.string().optional(),
    applicationNotes: z.string().max(1000).optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid request", errors: parsed.error.flatten() });
  }

  const serviceAreaZips = parsed.data.serviceAreaZips
    ? parsed.data.serviceAreaZips.split(",").map(s => s.trim()).filter(Boolean)
    : [];

  let logoUrl: string | undefined;
  if (req.file) {
    try {
      const uploadsDir = "dist/public/vendor-logos";
      await fs.mkdir(uploadsDir, { recursive: true });
      const filename = `vendor-${Date.now()}.webp`;
      const outputPath = path.join(uploadsDir, filename);
      await sharp(req.file.buffer)
        .resize(400, 400, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
        .webp({ quality: 85 })
        .toFile(outputPath);
      logoUrl = `/vendor-logos/${filename}`;
    } catch (err) {
      console.error("Logo upload failed:", err);
    }
  }

  const instagram = parsed.data.instagramHandle ? parsed.data.instagramHandle.replace(/^@/, "") : undefined;

  const vendor = await storage.createVendor({
    businessName: parsed.data.businessName,
    category: parsed.data.category,
    contactName: parsed.data.contactName,
    description: parsed.data.description,
    phone: parsed.data.phone,
    email: parsed.data.email,
    website: parsed.data.website || undefined,
    yelpUrl: parsed.data.yelpUrl || undefined,
    googleBusinessUrl: parsed.data.googleBusinessUrl || undefined,
    instagramHandle: instagram,
    facebookUrl: parsed.data.facebookUrl || undefined,
    nextdoorUrl: parsed.data.nextdoorUrl || undefined,
    serviceAreaNeighborhoods: parsed.data.serviceAreaNeighborhoods as string[],
    serviceAreaZips,
    applicationNotes: parsed.data.applicationNotes,
    logoUrl,
    status: "pending",
    isVerified: false,
    isActive: false,
  });

  try {
    await storage.createNotification({
      userId: DAVID_USER_ID,
      type: "vendor_application",
      title: `New vendor application: ${vendor.businessName}`,
      message: `${parsed.data.contactName} (${parsed.data.email}) applied to list ${vendor.businessName} in ${vendor.category}.`,
      metadata: { vendorId: vendor.id },
    });
  } catch (err) {
    console.error("Vendor application notification failed:", err);
  }

  try {
    const { sendSimpleEmail } = await import("../emailService");
    await sendSimpleEmail(
      parsed.data.email,
      "We received your application — Xucasa",
      `Hi ${parsed.data.contactName},\n\nThank you for applying to be listed on Xucasa! We review all applications within 2 business days.\n\nOnce approved, your business will appear in our local vendor directory where buyers and homeowners in your service area can find and contact you.\n\nBest,\nDavid Hussain\nXucasa`,
    );
  } catch (err) {
    console.error("Confirmation email failed:", err);
  }

  res.status(201).json({
    success: true,
    message: "Application submitted! We will review and be in touch within 2 business days.",
  });
});

router.post("/api/vendors/:id/request-bid", isAuthenticated, async (req: any, res) => {
  const schema = z.object({
    message: z.string().min(1).max(500),
    propertyAddress: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid request", errors: parsed.error.flatten() });

  const vendor = await storage.getVendor(Number(req.params.id));
  if (!vendor || vendor.status !== "approved") {
    return res.status(404).json({ message: "Vendor not found" });
  }

  await storage.createNotification({
    userId: DAVID_USER_ID,
    type: "vendor_bid_request",
    title: `Bid request for ${vendor.businessName}`,
    message: `${parsed.data.message}${parsed.data.propertyAddress ? ` — Property: ${parsed.data.propertyAddress}` : ""}`,
    metadata: { vendorId: vendor.id, requestingUserId: req.user?.claims?.sub },
  });

  res.json({ success: true, message: "Bid request sent. We will be in touch shortly." });
});

router.get("/api/admin/vendors", isAuthenticated, isAdmin, async (req, res) => {
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const vendors = await storage.listVendors({ status });
  res.json({ vendors });
});

router.patch("/api/admin/vendors/:id/approve", isAuthenticated, isAdmin, async (req: any, res) => {
  try {
    await executeWithAudit(
      {
        req,
        event: "vendor_approved",
        userId: req.user.claims.sub,
        role: "admin",
        resourceType: "vendor_profile",
        resourceId: req.params.id,
      },
      async () => {
        const vendor = await storage.updateVendor(Number(req.params.id), {
          status: "approved",
          isVerified: true,
          isActive: true,
        });
        if (vendor?.email) {
          try {
            const { sendSimpleEmail } = await import("../emailService");
            await sendSimpleEmail(
              vendor.email,
              "Your business is now listed on Xucasa!",
              `Congratulations! ${vendor.businessName} has been approved and is now live in the Xucasa vendor directory.\n\nBuyers and homeowners in your service area can now find and contact you.\n\nView your listing: https://xucasa.com/vendors\n\nBest,\nDavid Hussain\nXucasa`,
            );
          } catch (err) {
            console.error("Approval email failed:", err);
          }
        }
        return { data: vendor };
      },
    );
    res.json({ success: true });
  } catch (err: any) {
    console.error("Vendor approve error:", err);
    res.status(500).json({ message: "Failed to approve vendor" });
  }
});

router.patch("/api/admin/vendors/:id/reject", isAuthenticated, isAdmin, async (req: any, res) => {
  const schema = z.object({ reason: z.string().optional() });
  const parsed = schema.safeParse(req.body);
  try {
    await executeWithAudit(
      {
        req,
        event: "vendor_rejected",
        userId: req.user.claims.sub,
        role: "admin",
        resourceType: "vendor_profile",
        resourceId: req.params.id,
      },
      async () => {
        await storage.updateVendor(Number(req.params.id), {
          status: "rejected",
          isActive: false,
          adminNotes: parsed.success ? parsed.data.reason : undefined,
        });
        return { data: null };
      },
    );
    res.json({ success: true });
  } catch (err: any) {
    console.error("Vendor reject error:", err);
    res.status(500).json({ message: "Failed to reject vendor" });
  }
});

router.patch("/api/admin/vendors/:id", isAuthenticated, isAdmin, async (req, res) => {
  const schema = z.object({
    businessName: z.string().min(1).optional(),
    category: z.string().optional(),
    description: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().email().optional(),
    website: z.string().url().optional().or(z.literal("")),
    yelpUrl: z.string().url().optional().or(z.literal("")),
    googleBusinessUrl: z.string().url().optional().or(z.literal("")),
    instagramHandle: z.string().optional(),
    facebookUrl: z.string().url().optional().or(z.literal("")),
    nextdoorUrl: z.string().url().optional().or(z.literal("")),
    serviceAreaNeighborhoods: z.array(z.string()).optional(),
    serviceAreaZips: z.array(z.string()).optional(),
    isVerified: z.boolean().optional(),
    isActive: z.boolean().optional(),
    status: z.enum(["pending", "approved", "rejected"]).optional(),
    adminNotes: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid request", errors: parsed.error.flatten() });
  const vendor = await storage.updateVendor(Number(req.params.id), parsed.data as any);
  res.json({ vendor });
});

router.post("/api/partners/inquire", async (req, res) => {
  const schema = z.object({
    partnerType: z.enum(["vendor", "lender", "brokerage", "integration", "investor"]),
    businessName: z.string().min(1).max(100),
    contactName: z.string().min(1).max(100),
    email: z.string().email(),
    phone: z.string().optional(),
    website: z.string().url().optional().or(z.literal("")),
    message: z.string().max(1000).optional(),
    nmls: z.string().optional(),
    agentCount: z.string().optional(),
    mlsAffiliation: z.string().optional(),
    apiUseCase: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid request", errors: parsed.error.flatten() });

  const inquiry = await storage.createPartnerInquiry(parsed.data);

  try {
    await storage.createNotification({
      userId: DAVID_USER_ID,
      type: "partner_inquiry",
      title: `New ${parsed.data.partnerType} partner inquiry: ${parsed.data.businessName}`,
      message: `${parsed.data.contactName} (${parsed.data.email}) wants to partner as a ${parsed.data.partnerType}.`,
      metadata: { inquiryId: inquiry.id },
    });
  } catch (err) {
    console.error("Partner inquiry notification failed:", err);
  }

  try {
    const { sendSimpleEmail } = await import("../emailService");
    await sendSimpleEmail(
      parsed.data.email,
      "Thanks for reaching out — Xucasa",
      `Hi ${parsed.data.contactName},\n\nThank you for your interest in partnering with Xucasa! We review all inquiries personally and will be in touch within 2 business days.\n\nBest,\nDavid Hussain\nXucasa`,
    );
  } catch (err) {
    console.error("Partner inquiry email failed:", err);
  }

  res.status(201).json({ success: true, message: "Thank you for your interest. We will be in touch within 2 business days." });
});

router.get("/api/admin/partner-inquiries", isAuthenticated, isAdmin, async (req, res) => {
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const inquiries = await storage.listPartnerInquiries(status);
  res.json({ inquiries });
});

router.patch("/api/admin/partner-inquiries/:id", isAuthenticated, isAdmin, async (req, res) => {
  const schema = z.object({
    status: z.enum(["new", "contacted", "approved", "rejected"]).optional(),
    adminNotes: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid request", errors: parsed.error.flatten() });
  const inquiry = await storage.updatePartnerInquiry(Number(req.params.id), parsed.data);
  res.json({ inquiry });
});

export default router;
