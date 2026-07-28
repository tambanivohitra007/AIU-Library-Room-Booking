import logger from '../utils/logger.js';
import { getServiceSettings } from './settings.js';
import { Lang, dateLocaleTag } from './i18n.js';

// Contact fields hold one or more addresses, comma/semicolon-separated
export const parseEmails = (value: string | null | undefined): string[] => {
  return (value || '')
    .split(/[,;]/)
    .map((e) => e.trim())
    .filter((e) => e.includes('@'));
};

interface Branding {
  serviceName: string;
  logoUrl: string;
  contactEmails: string[];
}

const getBranding = async (): Promise<Branding> => {
  try {
    const settings = await getServiceSettings();
    return {
      serviceName: settings.serviceName,
      logoUrl: settings.logoUrl || `${process.env.CLIENT_URL || 'http://localhost:3000'}/assets/logo_small.jpg`,
      contactEmails: parseEmails(settings.contactEmail),
    };
  } catch (error) {
    logger.error('Failed to load branding settings for email:', error);
    return {
      serviceName: 'Room Booking',
      logoUrl: `${process.env.CLIENT_URL || 'http://localhost:3000'}/assets/logo_small.jpg`,
      contactEmails: [],
    };
  }
};

// Graph API Configuration
const TENANT_ID = process.env.AZURE_TENANT_ID;
const CLIENT_ID = process.env.AZURE_CLIENT_ID;
const CLIENT_SECRET = process.env.AZURE_CLIENT_SECRET;
const SENDER_EMAIL = process.env.SMTP_USER; // Reusing the configured email variable

let accessToken: string | null = null;
let tokenExpiresAt: number = 0;

/**
 * Get an Application Access Token for Microsoft Graph
 */
const getGraphAccessToken = async (): Promise<string | null> => {
  if (!TENANT_ID || !CLIENT_ID || !CLIENT_SECRET) {
    logger.error('Missing Azure credentials for Graph API');
    return null;
  }

  // Reuse token if valid
  if (accessToken && Date.now() < tokenExpiresAt) {
    return accessToken;
  }

  try {
    const params = new URLSearchParams();
    params.append('client_id', CLIENT_ID);
    params.append('scope', 'https://graph.microsoft.com/.default');
    params.append('client_secret', CLIENT_SECRET);
    params.append('grant_type', 'client_credentials');

    const response = await fetch(`https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`, {
      method: 'POST',
      body: params,
    });

    if (!response.ok) {
        const errorData = await response.json() as any;
        logger.error('Failed to get Graph Token:', errorData);
        return null;
    }

    const data = await response.json() as any;
    accessToken = data.access_token;
    // Set expiry (subtract 5 mins buffer)
    tokenExpiresAt = Date.now() + (data.expires_in * 1000) - 300000; 

    return accessToken;
  } catch (error) {
    logger.error('Error fetching Graph Token:', error);
    return null;
  }
};

/**
 * Send an email using Microsoft Graph API
 * NOTE: Application needs 'Mail.Send' permission in Azure AD
 */
export const sendEmail = async (to: string, subject: string, html: string) => {
  if (!SENDER_EMAIL) {
     logger.warn('SENDER_EMAIL (SMTP_USER) is not configured');
     return;
  }

  const token = await getGraphAccessToken();
  if (!token) {
    logger.warn('Could not authenticate with Microsoft Graph. Skipping notification.');
    return;
  }

  const emailData = {
    message: {
      subject: subject,
      body: {
        contentType: 'HTML',
        content: html,
      },
      toRecipients: [
        {
          emailAddress: {
            address: to,
          },
        },
      ],
    },
    saveToSentItems: 'true',
  };

  try {
    // Send as the configured user
    const response = await fetch(`https://graph.microsoft.com/v1.0/users/${SENDER_EMAIL}/sendMail`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailData),
    });

    if (response.ok) {
      logger.info(`Notification sent via Graph API to ${to}`);
    } else {
      const errorData = await response.json() as any;
      
      // Fallback/Debug logging
      logger.error('Failed to send Graph Email:', errorData);
      
       if (process.env.NODE_ENV !== 'production') {
          logger.info('--- FAILED NOTIFICATION CONTENT ---');
          logger.info(`To: ${to}`);
          logger.info(`Subject: ${subject}`);
          logger.info('Body Preview: ' + html.substring(0, 200));
          logger.info('HINT: Does the Azure App have "Mail.Send" Application Permission?');
       }
    }
  } catch (error) {
    logger.error('Error sending Graph Email:', error);
  }
};


const footerAssistText: Record<Lang, string> = {
  en: 'For assistance, please contact',
  th: 'หากต้องการความช่วยเหลือ กรุณาติดต่อ',
};

// Shared field labels used in the info boxes
const FIELD_LABELS: Record<Lang, { room: string; date: string; time: string; reason: string; requestedBy: string }> = {
  en: { room: 'Room', date: 'Date', time: 'Time', reason: 'Reason', requestedBy: 'Requested by' },
  th: { room: 'ห้อง', date: 'วันที่', time: 'เวลา', reason: 'เหตุผล', requestedBy: 'ผู้ขอจอง' },
};

const formatEmailDate = (date: Date, lang: Lang, opts: Intl.DateTimeFormatOptions) =>
  new Date(date).toLocaleDateString(dateLocaleTag(lang), opts);

const formatEmailTime = (date: Date, lang: Lang) =>
  new Date(date).toLocaleTimeString(dateLocaleTag(lang), { hour: '2-digit', minute: '2-digit' });

// HTML Email Template Builder
const getEmailTemplate = (title: string, content: string, branding: Branding, templateLang: Lang = 'en') => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; margin: 0; padding: 0; background-color: #f4f4f4; color: #333; }
        .container { max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background-color: #17365f; padding: 30px 40px; text-align: center; }
        .header img { max-height: 60px; max-width: 200px; }
        .header h1 { color: #ffffff; margin: 15px 0 0; font-size: 24px; font-weight: 600; letter-spacing: 0.5px; }
        .content { padding: 40px; }
        .info-box { background-color: #f8fafc; border-left: 4px solid #17365f; padding: 20px; margin: 25px 0; border-radius: 4px; }
        .info-row { display: flex; margin-bottom: 12px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; }
        .info-row:last-child { margin-bottom: 0; border-bottom: none; padding-bottom: 0; }
        .info-label { font-weight: 600; width: 100px; color: #64748b; font-size: 14px; text-transform: uppercase; }
        .info-value { flex: 1; color: #1e293b; font-weight: 500; }
        .cancel-warning { background-color: #fef2f2; border-left: 4px solid #ef4444; color: #991b1b; }
        .cancel-warning .info-label { color: #b91c1c; }
        .footer { background-color: #f1f5f9; padding: 20px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; }
        .footer a { color: #17365f; text-decoration: none; font-weight: 600; }
        .button { display: inline-block; padding: 12px 24px; background-color: #17365f; color: #ffffff !important; text-decoration: none; border-radius: 6px; font-weight: 600; margin-top: 20px; }
        @media only screen and (max-width: 600px) {
          .content { padding: 20px; }
          .header { padding: 20px; }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <!-- Logo -->
          <img src="${branding.logoUrl}" alt="${branding.serviceName} logo">
          <h1>${title}</h1>
        </div>
        <div class="content">
          ${content}
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} ${branding.serviceName}.</p>
          ${branding.contactEmails.length > 0 ? `<p>${footerAssistText[templateLang]} ${branding.contactEmails.map((e) => `<a href="mailto:${e}">${e}</a>`).join(', ')}</p>` : ''}
        </div>
      </div>
    </body>
    </html>
  `;
};

export const sendCancellationEmail = async (
  email: string,
  userName: string,
  details: { roomName: string; startTime: Date; reason?: string },
  lang: Lang = 'en'
) => {
  const branding = await getBranding();
  const S = {
    en: {
      subject: `Booking Cancelled - ${branding.serviceName}`,
      title: 'Booking Cancelled',
      greeting: `Dear <strong>${userName}</strong>,`,
      intro: `This email is to inform you that your room reservation with ${branding.serviceName} has been cancelled.`,
      outro: 'If you believe this cancellation was made in error or if you have any questions, please contact the administrators immediately.',
      button: 'Visit Booking System',
    },
    th: {
      subject: `การจองถูกยกเลิก - ${branding.serviceName}`,
      title: 'การจองถูกยกเลิก',
      greeting: `เรียน คุณ<strong>${userName}</strong>`,
      intro: `อีเมลฉบับนี้แจ้งให้ทราบว่าการจองห้องของคุณกับ ${branding.serviceName} ถูกยกเลิกแล้ว`,
      outro: 'หากคุณคิดว่าการยกเลิกนี้เกิดจากความผิดพลาด หรือมีข้อสงสัยใด ๆ กรุณาติดต่อผู้ดูแลระบบทันที',
      button: 'ไปที่ระบบจองห้อง',
    },
  }[lang];
  const L = FIELD_LABELS[lang];

  const dateStr = formatEmailDate(details.startTime, lang, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
  const timeStr = formatEmailTime(details.startTime, lang);

  const message = `
    <p style="font-size: 16px; margin-bottom: 20px;">${S.greeting}</p>
    <p>${S.intro}</p>

    <div class="info-box cancel-warning">
      <div class="info-row">
        <div class="info-label">${L.room}</div>
        <div class="info-value">${details.roomName}</div>
      </div>
      <div class="info-row">
        <div class="info-label">${L.date}</div>
        <div class="info-value">${dateStr}</div>
      </div>
      <div class="info-row">
        <div class="info-label">${L.time}</div>
        <div class="info-value">${timeStr}</div>
      </div>
      ${details.reason ? `
      <div class="info-row">
        <div class="info-label">${L.reason}</div>
        <div class="info-value">${details.reason}</div>
      </div>` : ''}
    </div>

    <p>${S.outro}</p>

    <div style="text-align: center;">
      <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}" class="button">${S.button}</a>
    </div>
  `;

  await sendEmail(email, S.subject, getEmailTemplate(S.title, message, branding, lang));
};

export const sendApprovalEmail = async (
  email: string,
  userName: string,
  details: { roomName: string; startTime: Date; endTime: Date },
  lang: Lang = 'en'
) => {
  const branding = await getBranding();
  const S = {
    en: {
      subject: `Booking Approved - ${branding.serviceName}`,
      title: 'Booking Approved',
      greeting: `Dear <strong>${userName}</strong>,`,
      intro: 'Good news — your booking request has been approved.',
      button: 'View My Bookings',
    },
    th: {
      subject: `การจองได้รับอนุมัติ - ${branding.serviceName}`,
      title: 'การจองได้รับอนุมัติ',
      greeting: `เรียน คุณ<strong>${userName}</strong>`,
      intro: 'ข่าวดี — คำขอจองของคุณได้รับการอนุมัติแล้ว',
      button: 'ดูการจองของฉัน',
    },
  }[lang];
  const L = FIELD_LABELS[lang];

  const dateStr = formatEmailDate(details.startTime, lang, {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
  const startTimeStr = formatEmailTime(details.startTime, lang);
  const endTimeStr = formatEmailTime(details.endTime, lang);

  const message = `
    <p style="font-size: 16px; margin-bottom: 20px;">${S.greeting}</p>
    <p>${S.intro}</p>

    <div class="info-box">
      <div class="info-row">
        <div class="info-label">${L.room}</div>
        <div class="info-value">${details.roomName}</div>
      </div>
      <div class="info-row">
        <div class="info-label">${L.date}</div>
        <div class="info-value">${dateStr}</div>
      </div>
      <div class="info-row">
        <div class="info-label">${L.time}</div>
        <div class="info-value">${startTimeStr} - ${endTimeStr}</div>
      </div>
    </div>

    <div style="text-align: center;">
      <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/my-bookings" class="button">${S.button}</a>
    </div>
  `;

  await sendEmail(email, S.subject, getEmailTemplate(S.title, message, branding, lang));
};

export const sendApprovalRequestEmail = async (
  recipients: string[],
  details: { roomName: string; userName: string; startTime: Date; endTime: Date }
) => {
  if (recipients.length === 0) return;
  const branding = await getBranding();
  const subject = `Booking Awaiting Approval - ${branding.serviceName}`;

  const dateStr = new Date(details.startTime).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
  const startTimeStr = new Date(details.startTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const endTimeStr = new Date(details.endTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  const message = `
    <p style="font-size: 16px; margin-bottom: 20px;">Hello,</p>
    <p>A new booking request is awaiting approval.</p>

    <div class="info-box">
      <div class="info-row">
        <div class="info-label">Room</div>
        <div class="info-value">${details.roomName}</div>
      </div>
      <div class="info-row">
        <div class="info-label">Requested by</div>
        <div class="info-value">${details.userName}</div>
      </div>
      <div class="info-row">
        <div class="info-label">Date</div>
        <div class="info-value">${dateStr}</div>
      </div>
      <div class="info-row">
        <div class="info-label">Time</div>
        <div class="info-value">${startTimeStr} - ${endTimeStr}</div>
      </div>
    </div>

    <p>Please review it in the admin dashboard. Unapproved requests are cancelled automatically when their start time passes.</p>

    <div style="text-align: center;">
      <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/admin" class="button">Review Requests</a>
    </div>
  `;

  const html = getEmailTemplate('Booking Awaiting Approval', message, branding);
  for (const to of recipients) {
    await sendEmail(to, subject, html);
  }
};

export const sendReminderEmail = async (
  email: string,
  userName: string,
  details: { roomName: string; startTime: Date; endTime: Date },
  lang: Lang = 'en'
) => {
  const branding = await getBranding();
  const S = {
    en: {
      subject: 'Reminder: Your Booking Starts Soon',
      title: 'Booking Reminder',
      greeting: `Dear <strong>${userName}</strong>,`,
      intro: `This is a friendly reminder that your upcoming room reservation with ${branding.serviceName} is scheduled to begin soon.`,
      outro: 'Please ensure you arrive on time. If you no longer need the room, please cancel your booking to make it available for others.',
      button: 'View My Bookings',
    },
    th: {
      subject: 'แจ้งเตือน: การจองของคุณกำลังจะเริ่ม',
      title: 'แจ้งเตือนการจอง',
      greeting: `เรียน คุณ<strong>${userName}</strong>`,
      intro: `ขอแจ้งเตือนว่าการจองห้องของคุณกับ ${branding.serviceName} กำลังจะเริ่มในไม่ช้า`,
      outro: 'กรุณามาถึงตรงเวลา หากไม่ต้องการใช้ห้องแล้ว กรุณายกเลิกการจองเพื่อเปิดโอกาสให้ผู้อื่นใช้งาน',
      button: 'ดูการจองของฉัน',
    },
  }[lang];
  const L = FIELD_LABELS[lang];

  const dateStr = formatEmailDate(details.startTime, lang, {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  });
  const startTimeStr = formatEmailTime(details.startTime, lang);
  const endTimeStr = formatEmailTime(details.endTime, lang);

  const message = `
    <p style="font-size: 16px; margin-bottom: 20px;">${S.greeting}</p>
    <p>${S.intro}</p>

    <div class="info-box">
      <div class="info-row">
        <div class="info-label">${L.room}</div>
        <div class="info-value">${details.roomName}</div>
      </div>
      <div class="info-row">
        <div class="info-label">${L.date}</div>
        <div class="info-value">${dateStr}</div>
      </div>
      <div class="info-row">
        <div class="info-label">${L.time}</div>
        <div class="info-value">${startTimeStr} - ${endTimeStr}</div>
      </div>
    </div>

    <p>${S.outro}</p>

    <div style="text-align: center;">
      <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/my-bookings" class="button">${S.button}</a>
    </div>
  `;

  await sendEmail(email, S.subject, getEmailTemplate(S.title, message, branding, lang));
};
