import logger from '../utils/logger.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOGO_PATH = path.join(__dirname, '../../../client/assets/logo_small.jpg');

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


// HTML Email Template Builder
const getEmailTemplate = (title: string, content: string) => {
  // Use a publicly accessible URL for the logo if possible, or embed it if small enough.
  // Since we can't easily embed local files in email clients, we'll use a placeholder or public URL
  // For production, this should be hosted (e.g., https://your-domain.com/assets/logo.png)
  const logoUrl = `${process.env.CLIENT_URL || 'https://booking.apiu.edu'}/assets/logo_small.jpg`;

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
          <img src="${logoUrl}" alt="AIU Library Logo">
          <h1>${title}</h1>
        </div>
        <div class="content">
          ${content}
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} Asia-Pacific International University Library.</p>
          <p>For assistance, please contact <a href="mailto:libadmin@apiu.edu">libadmin@apiu.edu</a></p>
        </div>
      </div>
    </body>
    </html>
  `;
};

export const sendCancellationEmail = async (
  email: string, 
  userName: string, 
  details: { roomName: string; startTime: Date; reason?: string }
) => {
  const subject = 'Booking Cancelled - AIU Library Room Booking';
  
  const dateStr = new Date(details.startTime).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });

  const timeStr = new Date(details.startTime).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });

  const message = `
    <p style="font-size: 16px; margin-bottom: 20px;">Dear <strong>${userName}</strong>,</p>
    <p>This email is to inform you that your room reservation at the AIU Library has been cancelled.</p>
    
    <div class="info-box cancel-warning">
      <div class="info-row">
        <div class="info-label">Room</div>
        <div class="info-value">${details.roomName}</div>
      </div>
      <div class="info-row">
        <div class="info-label">Date</div>
        <div class="info-value">${dateStr}</div>
      </div>
      <div class="info-row">
        <div class="info-label">Time</div>
        <div class="info-value">${timeStr}</div>
      </div>
      ${details.reason ? `
      <div class="info-row">
        <div class="info-label">Reason</div>
        <div class="info-value">${details.reason}</div>
      </div>` : ''}
    </div>

    <p>If you believe this cancellation was made in error or if you have any questions, please contact the library administration immediately.</p>
    
    <div style="text-align: center;">
      <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}" class="button">Visit Library System</a>
    </div>
  `;

  await sendEmail(email, subject, getEmailTemplate('Booking Cancelled', message));
};

export const sendReminderEmail = async (
  email: string, 
  userName: string, 
  details: { roomName: string; startTime: Date; endTime: Date }
) => {
  const subject = 'Reminder: Your Booking Starts Soon';
  
  const dateStr = new Date(details.startTime).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  });

  const startTimeStr = new Date(details.startTime).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });
  
  const endTimeStr = new Date(details.endTime).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });

  const message = `
    <p style="font-size: 16px; margin-bottom: 20px;">Dear <strong>${userName}</strong>,</p>
    <p>This is a friendly reminder that your upcoming room reservation at the AIU Library is scheduled to begin soon.</p>
    
    <div class="info-box">
      <div class="info-row">
        <div class="info-label">Room</div>
        <div class="info-value">${details.roomName}</div>
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

    <p>Please ensure you arrive on time. If you no longer need the room, please cancel your booking to make it available for other students.</p>
    
    <div style="text-align: center;">
      <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/my-bookings" class="button">View My Bookings</a>
    </div>
  `;

  await sendEmail(email, subject, getEmailTemplate('Booking Reminder', message));
};
