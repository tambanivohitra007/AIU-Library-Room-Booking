
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { getServiceSettings, parseOperatingHoursJson, MAX_APPROVAL_LEAD_MINUTES } from '../services/settings.js';
import { trReq } from '../services/i18n.js';
import { recordAudit } from '../services/audit.js';
import { AuthRequest } from '../middleware/auth.js';

const prisma = new PrismaClient();

export const getSettings = async (req: Request, res: Response): Promise<void> => {
    try {
        const settings = await getServiceSettings();
        res.json(settings);
    } catch (error) {
        console.error('Error fetching settings:', error);
        res.status(500).json({ message: trReq(req, 'fetchSettingsFailed') });
    }
};

export const updateSettings = async (req: Request, res: Response): Promise<void> => {
    try {
        const { serviceName, logoUrl, contactEmail, websiteUrl, description, allowedEmailDomains, operatingHours, allowSelfRegistration, approvalLeadTimeMinutes } = req.body;

        // Reject malformed operating hours instead of silently breaking the schedule
        if (operatingHours && !parseOperatingHoursJson(operatingHours)) {
            res.status(400).json({ message: trReq(req, 'invalidOperatingHours') });
            return;
        }

        // A bad lead time silently makes every approval-gated room unbookable,
        // so validate it here rather than clamping it out of sight.
        if (approvalLeadTimeMinutes !== undefined) {
            const lead = Number(approvalLeadTimeMinutes);
            if (!Number.isInteger(lead) || lead < 0 || lead > MAX_APPROVAL_LEAD_MINUTES) {
                res.status(400).json({ message: trReq(req, 'invalidApprovalLeadTime') });
                return;
            }
        }

        const data = {
            serviceName,
            logoUrl,
            contactEmail,
            websiteUrl,
            description,
            allowedEmailDomains,
            operatingHours,
            ...(typeof allowSelfRegistration === 'boolean' ? { allowSelfRegistration } : {}),
            ...(approvalLeadTimeMinutes !== undefined
                ? { approvalLeadTimeMinutes: Number(approvalLeadTimeMinutes) }
                : {}),
        };

        const existing = await prisma.serviceSettings.findFirst();

        let settings;
        if (existing) {
            settings = await prisma.serviceSettings.update({
                where: { id: existing.id },
                data,
            });
        } else {
            settings = await prisma.serviceSettings.create({ data });
        }

        // Service-wide config: the domain allowlist gates who may register at all,
        // and operatingHours is the default schedule for every room.
        const changed: string[] = [];
        if (existing) {
            if (existing.serviceName !== settings.serviceName) changed.push('serviceName');
            if (existing.allowedEmailDomains !== settings.allowedEmailDomains) changed.push('allowedEmailDomains');
            if (existing.operatingHours !== settings.operatingHours) changed.push('operatingHours');
            if (existing.allowSelfRegistration !== settings.allowSelfRegistration) changed.push('allowSelfRegistration');
            if (existing.approvalLeadTimeMinutes !== settings.approvalLeadTimeMinutes) changed.push('approvalLeadTimeMinutes');
        }
        await recordAudit(req as AuthRequest, {
            action: 'SETTINGS_UPDATE',
            targetType: 'ServiceSettings',
            targetId: settings.id,
            targetLabel: settings.serviceName,
            summary: changed.length
                ? `Updated service settings: ${changed.join(', ')}`
                : 'Updated service settings',
            metadata: {
                changed,
                domainsFrom: changed.includes('allowedEmailDomains') ? existing?.allowedEmailDomains : undefined,
                domainsTo: changed.includes('allowedEmailDomains') ? settings.allowedEmailDomains : undefined,
            },
        });

        res.json(settings);
    } catch (error) {
        console.error('Error updating settings:', error);
        res.status(500).json({ message: trReq(req, 'updateSettingsFailed') });
    }
};
