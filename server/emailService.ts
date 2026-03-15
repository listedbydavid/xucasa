import nodemailer from "nodemailer";

const DAILY_EMAIL_LIMIT = 20;

const BRAND = {
  name: "xucasa",
  tagline: "San Diego Real Estate",
  primaryColor: "#2563eb",
  logoText: "xucasa",
};

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || "587");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  return transporter;
}

export function isEmailConfigured(): boolean {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

const recentEmails = new Map<string, { hash: string; sentAt: number }[]>();

function deduplicationKey(userId: string, type: string, title: string): string {
  return `${userId}:${type}:${title}`;
}

function isDuplicate(userId: string, type: string, title: string): boolean {
  const key = deduplicationKey(userId, type, title);
  const recent = recentEmails.get(key);
  if (!recent) return false;

  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  const validEntries = recent.filter(e => e.sentAt > oneHourAgo);
  recentEmails.set(key, validEntries);

  return validEntries.length > 0;
}

function recordEmail(userId: string, type: string, title: string) {
  const key = deduplicationKey(userId, type, title);
  const existing = recentEmails.get(key) || [];
  existing.push({ hash: key, sentAt: Date.now() });
  recentEmails.set(key, existing);
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildEmailHtml(params: {
  title: string;
  message: string;
  type: string;
  linkUrl?: string | null;
  recipientName?: string;
}): string {
  const { type, linkUrl } = params;
  const title = escapeHtml(params.title);
  const message = escapeHtml(params.message);
  const recipientName = params.recipientName ? escapeHtml(params.recipientName) : undefined;

  const typeLabels: Record<string, string> = {
    new_listing: "New Listing",
    price_drop: "Price Drop",
    agent_match: "Agent Match",
    open_house: "Open House",
    system: "System",
  };

  const typeColors: Record<string, string> = {
    new_listing: "#16a34a",
    price_drop: "#ea580c",
    agent_match: "#2563eb",
    open_house: "#9333ea",
    system: "#6b7280",
  };

  const typeEmoji: Record<string, string> = {
    new_listing: "🏠",
    price_drop: "📉",
    agent_match: "🤝",
    open_house: "📅",
    system: "ℹ️",
  };

  const label = typeLabels[type] || "Notification";
  const color = typeColors[type] || BRAND.primaryColor;
  const emoji = typeEmoji[type] || "📬";
  const baseUrl = process.env.REPLIT_DEV_DOMAIN
    ? `https://${process.env.REPLIT_DEV_DOMAIN}`
    : process.env.REPL_SLUG
      ? `https://${process.env.REPL_SLUG}.repl.co`
      : "https://xucasa.com";
  const sanitizedLinkUrl = linkUrl && linkUrl.startsWith("/") ? linkUrl : null;
  const fullLink = sanitizedLinkUrl ? `${baseUrl}${sanitizedLinkUrl}` : null;
  const greeting = recipientName ? `Hi ${recipientName},` : "Hi,";

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
        <tr><td style="background:linear-gradient(135deg,${BRAND.primaryColor},#1d4ed8);padding:24px 32px;">
          <table width="100%"><tr>
            <td><span style="font-size:24px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">${BRAND.logoText}</span></td>
            <td align="right"><span style="font-size:12px;color:rgba(255,255,255,0.8);">${BRAND.tagline}</span></td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:32px;">
          <table width="100%"><tr><td>
            <span style="display:inline-block;padding:4px 12px;border-radius:20px;background-color:${color}15;color:${color};font-size:12px;font-weight:600;margin-bottom:12px;">${emoji} ${label}</span>
            <h1 style="margin:12px 0 8px;font-size:20px;font-weight:700;color:#18181b;line-height:1.3;">${title}</h1>
            <p style="margin:0 0 16px;color:#71717a;font-size:14px;">${greeting}</p>
            <p style="margin:0 0 24px;color:#3f3f46;font-size:15px;line-height:1.6;">${message}</p>
            ${fullLink ? `<a href="${fullLink}" style="display:inline-block;padding:12px 24px;background-color:${BRAND.primaryColor};color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">View Details</a>` : ""}
          </td></tr></table>
        </td></tr>
        <tr><td style="padding:24px 32px;border-top:1px solid #e4e4e7;background-color:#fafafa;">
          <table width="100%"><tr>
            <td><p style="margin:0;font-size:12px;color:#a1a1aa;">This email was sent by ${BRAND.name}.</p></td>
            <td align="right"><a href="${baseUrl}/dashboard?section=notifications" style="font-size:12px;color:${BRAND.primaryColor};text-decoration:none;">Manage Preferences</a></td>
          </tr></table>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export interface SendNotificationEmailParams {
  to: string;
  recipientName?: string;
  type: string;
  title: string;
  message: string;
  linkUrl?: string | null;
  userId: string;
  emailsSentToday: number;
}

export async function sendNotificationEmail(params: SendNotificationEmailParams): Promise<{ sent: boolean; reason?: string }> {
  const { to, recipientName, type, title, message, linkUrl, userId, emailsSentToday } = params;

  if (!isEmailConfigured()) {
    return { sent: false, reason: "SMTP not configured" };
  }

  if (emailsSentToday >= DAILY_EMAIL_LIMIT) {
    return { sent: false, reason: `Daily limit reached (${DAILY_EMAIL_LIMIT})` };
  }

  if (isDuplicate(userId, type, title)) {
    return { sent: false, reason: "Duplicate email suppressed" };
  }

  const transport = getTransporter();
  if (!transport) {
    return { sent: false, reason: "Transport not available" };
  }

  const fromName = process.env.SMTP_FROM_NAME || BRAND.name;
  const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER;

  try {
    await transport.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to,
      subject: `${title} — ${BRAND.name}`,
      html: buildEmailHtml({ title, message, type, linkUrl, recipientName }),
    });

    recordEmail(userId, type, title);
    console.log(`[Email] Sent ${type} notification to ${to}`);
    return { sent: true };
  } catch (err: any) {
    console.error(`[Email] Failed to send to ${to}:`, err.message);
    return { sent: false, reason: err.message };
  }
}

export async function sendTestEmail(to: string, recipientName?: string): Promise<{ sent: boolean; reason?: string }> {
  if (!isEmailConfigured()) {
    return { sent: false, reason: "SMTP not configured. Set SMTP_HOST, SMTP_USER, and SMTP_PASS environment variables." };
  }

  const transport = getTransporter();
  if (!transport) {
    return { sent: false, reason: "Transport not available" };
  }

  const fromName = process.env.SMTP_FROM_NAME || BRAND.name;
  const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER;

  try {
    await transport.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to,
      subject: `Test Email — ${BRAND.name}`,
      html: buildEmailHtml({
        title: "Test Email Successful!",
        message: "This is a test email from xucasa. If you received this, your email notifications are working correctly. You can manage your notification preferences from your dashboard.",
        type: "system",
        linkUrl: "/dashboard?section=notifications",
        recipientName,
      }),
    });
    console.log(`[Email] Test email sent to ${to}`);
    return { sent: true };
  } catch (err: any) {
    console.error(`[Email] Test email failed:`, err.message);
    return { sent: false, reason: err.message };
  }
}
