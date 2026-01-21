
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getSettings = async (req: Request, res: Response): Promise<void> => {
    try {
        // Find existing settings or create default
        let settings = await prisma.serviceSettings.findFirst();

        if (!settings) {
            settings = await prisma.serviceSettings.create({
                data: {
                    serviceName: 'AIU Library Room Booking',
                    description: 'Default room booking system description',
                }
            });
        }

        res.json(settings);
    } catch (error) {
        console.error('Error fetching settings:', error);
        res.status(500).json({ message: 'Error fetching settings' });
    }
};

export const updateSettings = async (req: Request, res: Response): Promise<void> => {
    try {
        const { serviceName, logoUrl, contactEmail, websiteUrl, description } = req.body;

        // Find the first record
        const existing = await prisma.serviceSettings.findFirst();

        let settings;
        if (existing) {
            settings = await prisma.serviceSettings.update({
                where: { id: existing.id },
                data: {
                    serviceName,
                    logoUrl,
                    contactEmail,
                    websiteUrl,
                    description,
                },
            });
        } else {
            settings = await prisma.serviceSettings.create({
                data: {
                    serviceName,
                    logoUrl,
                    contactEmail,
                    websiteUrl,
                    description,
                },
            });
        }

        res.json(settings);
    } catch (error) {
        console.error('Error updating settings:', error);
        res.status(500).json({ message: 'Error updating settings' });
    }
};
