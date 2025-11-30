import { Request, Response } from 'express';
import { CardDavService } from '../services/cardDavService';
import firebaseService from '../services/firebaseService';

const cardDavService = new CardDavService();

export const fetchICloudContacts = async (req: Request, res: Response) => {
    const { email, appSpecificPassword } = req.body;

    if (!email || !appSpecificPassword) {
        res.status(400).json({ error: 'Email and App-Specific Password are required.' });
        return;
    }

    try {
        const contacts = await cardDavService.getICloudContacts({ email, appSpecificPassword });
        res.json({ contacts });
    } catch (error) {
        // Avoid logging sensitive credentials
        console.error('Error fetching iCloud contacts:', (error as Error).message);
        res.status(401).json({ error: 'Failed to fetch contacts. Please check your credentials.' });
    }
};

export const syncToICloud = async (req: Request, res: Response) => {
    const { email, appSpecificPassword, contactIds } = req.body;

    if (!email || !appSpecificPassword || !Array.isArray(contactIds)) {
        res.status(400).json({ error: 'Email, App-Specific Password, and contactIds array are required.' });
        return;
    }

    try {
        // Fetch contacts from Firebase
        const result = await firebaseService.getContactsByIds(contactIds);

        if (!result.success) {
            throw new Error(result.error);
        }

        const contacts = result.data as any[];

        // Debug: Log what we got from Firebase
        console.log('=== FIREBASE CONTACTS DEBUG ===');
        console.log(`Total contacts fetched: ${contacts.length}`);
        contacts.forEach((c, idx) => {
            console.log(`\nContact ${idx + 1}:`, JSON.stringify(c, null, 2));
            console.log(`Available keys:`, Object.keys(c));
        });

        // Map Firebase contacts to the Contact interface expected by CardDavService
        const formattedContacts = contacts.map((c, idx) => {
            let firstName = '';
            let lastName = '';

            // Check if we have separate firstName/lastName fields
            if (c.firstName || c.first_name || c.name?.first) {
                firstName = c.firstName || c.first_name || c.name?.first || '';
                lastName = c.lastName || c.last_name || c.name?.last || '';
            }
            // Otherwise, check if we have a single 'name' field and split it
            else if (c.name && typeof c.name === 'string') {
                const nameParts = c.name.trim().split(/\s+/);
                if (nameParts.length === 1) {
                    // Single word name - use as first name
                    firstName = nameParts[0];
                } else if (nameParts.length >= 2) {
                    // Multiple words - first word is firstName, rest is lastName
                    firstName = nameParts[0];
                    lastName = nameParts.slice(1).join(' ');
                }
            }

            const formatted = {
                firstName,
                lastName,
                phone: c.phone || c.phoneNumber || c.phone_number || c.mobile || '',
                email: c.email || c.emailAddress || c.email_address || '',
                firebaseId: c.id // Include Firebase ID for tracking
            };

            console.log(`\nFormatted contact ${idx + 1}:`, formatted);
            return formatted;
        });

        console.log('\n=== END DEBUG ===\n');

        await cardDavService.exportToICloud({ email, appSpecificPassword }, formattedContacts);

        res.json({ message: 'Contacts synced successfully to iCloud.' });
    } catch (error) {
        console.error('Error syncing to iCloud:', (error as Error).message);
        // Check if it's likely an auth error (simple heuristic)
        if ((error as Error).message.includes('401') || (error as Error).message.toLowerCase().includes('unauthorized')) {
            res.status(401).json({ error: 'Failed to sync contacts. Please check your iCloud credentials.' });
        } else {
            res.status(500).json({ error: 'Failed to sync contacts to iCloud.' });
        }
    }
};

export const importContactsToFirebase = async (req: Request, res: Response) => {
    const { contacts } = req.body;

    if (!Array.isArray(contacts)) {
        res.status(400).json({ error: 'Contacts array is required.' });
        return;
    }

    try {
        const result = await firebaseService.batchCreateContacts(contacts);

        if (!result.success) {
            throw new Error(result.error);
        }

        res.json({
            message: 'Contacts imported successfully.',
            count: result.count
        });
    } catch (error) {
        console.error('Error importing contacts:', (error as Error).message);
        res.status(500).json({ error: 'Failed to import contacts.' });
    }
};
