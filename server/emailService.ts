import { google } from "googleapis";

const DAILY_EMAIL_LIMIT = 20;

const BRAND = {
  name: "xucasa",
  tagline: "San Diego Real Estate",
  primaryColor: "#2563eb",
  logoText: "xucasa",
};

// --- Gmail connector integration (Replit Gmail connector) ---
let connectionSettings: any;

async function getAccessToken(): Promise<string> {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }

  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
    ? "depl " + process.env.WEB_REPL_RENEWAL
    : null;

  if (!xReplitToken) {
    throw new Error("X-Replit-Token not found for repl/depl");
  }

  connectionSettings = await fetch(
    "https://" + hostname + "/api/v2/connection?include_secrets=true&connector_names=google-mail",
    {
      headers: {
        Accept: "application/json",
        "X-Replit-Token": xReplitToken,
      },
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings?.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error("Gmail not connected");
  }
  return accessToken;
}

async function getGmailClient() {
  const accessToken = await getAccessToken();
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });
  return google.gmail({ version: "v1", auth: oauth2Client });
}

let gmailAvailable: boolean | null = null;
let gmailCacheTime = 0;
const GMAIL_CACHE_TTL = 60_000;

export async function isEmailConfigured(): Promise<boolean> {
  if (gmailAvailable !== null && Date.now() - gmailCacheTime < GMAIL_CACHE_TTL) {
    return gmailAvailable;
  }
  try {
    await getAccessToken();
    gmailAvailable = true;
    gmailCacheTime = Date.now();
    return true;
  } catch {
    gmailAvailable = false;
    gmailCacheTime = Date.now();
    return false;
  }
}

export function resetEmailConfigCache() {
  gmailAvailable = null;
  gmailCacheTime = 0;
  connectionSettings = null;
}

// --- Deduplication: keyed by userId + type + propertyId, 1-hour window ---
const recentEmails = new Map<string, number[]>();

function deduplicationKey(userId: string, type: string, propertyId: number | null | undefined): string {
  return `${userId}:${type}:${propertyId ?? "none"}`;
}

function isDuplicate(userId: string, type: string, propertyId: number | null | undefined): boolean {
  const key = deduplicationKey(userId, type, propertyId);
  const timestamps = recentEmails.get(key);
  if (!timestamps) return false;

  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  const valid = timestamps.filter(ts => ts > oneHourAgo);
  recentEmails.set(key, valid);

  return valid.length > 0;
}

function recordEmail(userId: string, type: string, propertyId: number | null | undefined) {
  const key = deduplicationKey(userId, type, propertyId);
  const existing = recentEmails.get(key) || [];
  existing.push(Date.now());
  recentEmails.set(key, existing);
}

// --- HTML escaping ---
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// --- Branded email template ---
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
    new_listing: "\u{1F3E0}",
    price_drop: "\u{1F4C9}",
    agent_match: "\u{1F91D}",
    open_house: "\u{1F4C5}",
    system: "\u{2139}\u{FE0F}",
  };

  const label = typeLabels[type] || "Notification";
  const color = typeColors[type] || BRAND.primaryColor;
  const emoji = typeEmoji[type] || "\u{1F4EC}";
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

// --- Build RFC 2822 raw message for Gmail API ---
function buildRawMessage(to: string, subject: string, htmlBody: string, fromEmail: string): string {
  const boundary = "boundary_" + Date.now().toString(36);
  const lines = [
    `From: "${BRAND.name}" <${fromEmail}>`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/html; charset=UTF-8`,
    `Content-Transfer-Encoding: base64`,
    ``,
    Buffer.from(htmlBody).toString("base64"),
    ``,
    `--${boundary}--`,
  ];
  return Buffer.from(lines.join("\r\n")).toString("base64url");
}

// --- Send email via Gmail API ---
async function sendViaGmail(to: string, subject: string, htmlBody: string): Promise<void> {
  const gmail = await getGmailClient();
  const profile = await gmail.users.getProfile({ userId: "me" });
  const fromEmail = profile.data.emailAddress || "noreply@xucasa.com";
  const raw = buildRawMessage(to, subject, htmlBody, fromEmail);
  await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw },
  });
}

export interface SendNotificationEmailParams {
  to: string;
  recipientName?: string;
  type: string;
  title: string;
  message: string;
  linkUrl?: string | null;
  propertyId?: number | null;
  userId: string;
  emailsSentToday: number;
}

export async function sendNotificationEmail(params: SendNotificationEmailParams): Promise<{ sent: boolean; reason?: string }> {
  const { to, recipientName, type, title, message, linkUrl, propertyId, userId, emailsSentToday } = params;

  const configured = await isEmailConfigured();
  if (!configured) {
    return { sent: false, reason: "Gmail not connected" };
  }

  if (emailsSentToday >= DAILY_EMAIL_LIMIT) {
    return { sent: false, reason: `Daily limit reached (${DAILY_EMAIL_LIMIT})` };
  }

  if (isDuplicate(userId, type, propertyId)) {
    return { sent: false, reason: "Duplicate email suppressed" };
  }

  try {
    const subject = `${title} \u2014 ${BRAND.name}`;
    const html = buildEmailHtml({ title, message, type, linkUrl, recipientName });
    await sendViaGmail(to, subject, html);

    recordEmail(userId, type, propertyId);
    console.log(`[Email] Sent ${type} notification to ${to}`);
    return { sent: true };
  } catch (err: any) {
    console.error(`[Email] Failed to send to ${to}:`, err.message);
    resetEmailConfigCache();
    return { sent: false, reason: err.message };
  }
}

export async function sendTestEmail(to: string, recipientName?: string): Promise<{ sent: boolean; reason?: string }> {
  const configured = await isEmailConfigured();
  if (!configured) {
    return { sent: false, reason: "Gmail not connected. Please connect the Gmail integration in the Integrations panel." };
  }

  try {
    const subject = `Test Email \u2014 ${BRAND.name}`;
    const html = buildEmailHtml({
      title: "Test Email Successful!",
      message: "This is a test email from xucasa. If you received this, your email notifications are working correctly. You can manage your notification preferences from your dashboard.",
      type: "system",
      linkUrl: "/dashboard?section=notifications",
      recipientName,
    });
    await sendViaGmail(to, subject, html);
    console.log(`[Email] Test email sent to ${to}`);
    return { sent: true };
  } catch (err: any) {
    console.error(`[Email] Test email failed:`, err.message);
    resetEmailConfigCache();
    return { sent: false, reason: err.message };
  }
}
