
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { getServiceSettings, parseOperatingHoursJson } from '../services/settings.js';
import { trReq } from '../services/i18n.js';

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
        const { serviceName, logoUrl, contactEmail, websiteUrl, description, allowedEmailDomains, operatingHours, allowSelfRegistration } = req.body;

        // Reject malformed operating hours instead of silently breaking the schedule
        if (operatingHours && !parseOperatingHoursJson(operatingHours)) {
            res.status(400).json({ message: trReq(req, 'invalidOperatingHours') });
            return;
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

        res.json(settings);
    } catch (error) {
        console.error('Error updating settings:', error);
        res.status(500).json({ message: trReq(req, 'updateSettingsFailed') });
    }
};
