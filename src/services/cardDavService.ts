import { DAVClient } from 'tsdav';
import { v4 as uuidv4 } from 'uuid';
import { Contact, jsonToVCard, vCardToJson } from '../utils/vCardHelpers';

interface ICloudCredentials {
    email: string;
    appSpecificPassword: string;
}

export class CardDavService {
    private static ICLOUD_DAV_URL = 'https://contacts.icloud.com';

    /**
     * Fetch contacts from iCloud
     */
    async getICloudContacts(credentials: ICloudCredentials): Promise<Contact[]> {
        const client = new DAVClient({
            serverUrl: CardDavService.ICLOUD_DAV_URL,
            credentials: {
                username: credentials.email,
                password: credentials.appSpecificPassword,
            },
            authMethod: 'Basic',
            defaultAccountType: 'carddav',
        });

        await client.login();

        const addressBooks = await client.fetchAddressBooks();

        if (addressBooks.length === 0) {
            return [];
        }

        // Use the first address book found
        const addressBook = addressBooks[0];

        const vCards = await client.fetchVCards({
            addressBook: addressBook,
        });

        console.log('\n=== ICLOUD CONTACTS DEBUG ===');
        console.log(`Total vCards fetched: ${vCards.length}`);

        // Search for recently uploaded contacts
        const recentUploads = [
            '4f6bc818-2bdd-400d-8d8c-965595a761fd', // Abdul Azeem Haqani
            '9a87c20f-7c6c-4374-a7ed-bd38045eaf20', // Adam Teli
            'cecad4c8-24af-48c9-bad7-a781b1ea3d51', // Another Adam upload
        ];

        console.log('\n--- Searching for our uploaded contacts ---');
        recentUploads.forEach(uid => {
            const found = vCards.find(v => v.data.includes(uid));
            if (found) {
                console.log(`✓ FOUND UID ${uid}:`);
                console.log('  URL:', found.url);
                console.log('  Data:', found.data);
            } else {
                console.log(`✗ NOT FOUND: ${uid}`);
            }
        });
        console.log('--- End search ---\n');

        // Log first 3 contacts in detail
        vCards.slice(0, 3).forEach((vCard, idx) => {
            console.log(`\n--- vCard ${idx + 1} ---`);
            console.log('URL:', vCard.url);
            console.log('ETag:', vCard.etag);
            console.log('\nRaw vCard Data:');
            console.log(vCard.data);
            console.log('--- End vCard ---\n');
        });
        console.log('=== END ICLOUD DEBUG ===\n');

        const contacts: Contact[] = vCards.map((vCard) => {
            try {
                // vCard.data contains the vCard string
                return vCardToJson(vCard.data);
            } catch (error) {
                console.error('Error parsing vCard:', error);
                return null;
            }
        }).filter((c): c is Contact => c !== null);

        return contacts;
    }

    /**
     * Export contacts to iCloud and add them to KMYC group
     */
    async exportToICloud(credentials: ICloudCredentials, contacts: Contact[], groupName: string = 'KMYC'): Promise<void> {
        const client = new DAVClient({
            serverUrl: CardDavService.ICLOUD_DAV_URL,
            credentials: {
                username: credentials.email,
                password: credentials.appSpecificPassword,
            },
            authMethod: 'Basic',
            defaultAccountType: 'carddav',
        });

        await client.login();

        const addressBooks = await client.fetchAddressBooks();

        if (addressBooks.length === 0) {
            throw new Error('No address book found in iCloud account.');
        }

        // Debugging: Log what we found
        console.log('Found Address Books:', addressBooks.map(b => ({ name: b.displayName, url: b.url })));

        // Try to find the main "Contacts" or "card" address book
        const addressBook = addressBooks.find(b =>
            (typeof b.displayName === 'string' && b.displayName.toLowerCase() === 'contacts') ||
            b.url.toLowerCase().endsWith('/card/')
        ) || addressBooks[0];

        console.log('Selected Address Book:', addressBook.displayName, addressBook.url);

        // Fetch all existing vCards to check for duplicates
        console.log('Fetching existing contacts to check for duplicates...');
        const existingVCards = await client.fetchVCards({ addressBook });
        console.log(`Found ${existingVCards.length} existing contacts`);

        let failureCount = 0;
        let successCount = 0;
        let updateCount = 0;
        let createCount = 0;
        const uploadedUIDs: string[] = [];

        for (const contact of contacts) {
            try {
                // Check if contact already exists by Firebase ID
                let existingContact = null;
                if (contact.firebaseId) {
                    existingContact = existingVCards.find((vcard: any) =>
                        vcard.data.includes(`X-FIREBASE-ID:${contact.firebaseId}`)
                    );
                }

                if (existingContact) {
                    // UPDATE existing contact
                    console.log(`\n📝 Updating existing contact for ${contact.firstName || 'contact'} (Firebase ID: ${contact.firebaseId})`);

                    // Extract existing UID
                    const uidMatch = existingContact.data.match(/UID:([^\r\n]+)/);
                    const uid = uidMatch ? uidMatch[1] : uuidv4();

                    // Generate updated vCard with same UID
                    const vCardString = jsonToVCard(contact, uid);

                    console.log('Updated vCard:\n', vCardString);

                    // Update the existing contact
                    await client.updateVCard({
                        vCard: {
                            url: existingContact.url,
                            data: vCardString,
                            etag: existingContact.etag
                        }
                    });

                    console.log(`✓ Successfully updated: ${existingContact.url}`);
                    uploadedUIDs.push(uid);
                    updateCount++;
                } else {
                    // CREATE new contact
                    const uid = uuidv4();
                    const filename = `${uid}.vcf`;

                    const vCardString = jsonToVCard(contact, uid);

                    console.log(`\n➕ Creating new contact for ${contact.firstName || 'contact'}:\n`, vCardString);

                    await client.createVCard({
                        addressBook: addressBook,
                        filename: filename,
                        vCardString: vCardString,
                    });

                    console.log(`✓ Successfully created: ${filename}`);
                    uploadedUIDs.push(uid);
                    createCount++;
                }

                // Wait a moment between operations
                await new Promise(resolve => setTimeout(resolve, 300));

                successCount++;
            } catch (error) {
                console.error(`❌ Failed to sync contact ${contact.firstName || 'contact'}:`, error);
                failureCount++;
            }
        }

        console.log(`\n=== SYNC SUMMARY ===`);
        console.log(`Total: ${contacts.length} contacts`);
        console.log(`Created: ${createCount}`);
        console.log(`Updated: ${updateCount}`);
        console.log(`Failed: ${failureCount}`);
        console.log(`===================\n`);

        // Add contacts to group if any were uploaded successfully
        if (uploadedUIDs.length > 0) {
            try {
                await this.addContactsToGroup(client, addressBook, groupName, uploadedUIDs);
                console.log(`✓ Added ${uploadedUIDs.length} contacts to group "${groupName}"`);
            } catch (error) {
                console.error(`Failed to add contacts to group "${groupName}":`, (error as Error).message);
            }
        }

        if (contacts.length > 0 && failureCount === contacts.length) {
            throw new Error('All contact uploads failed. Please check your permissions or network connection.');
        }
    }

    /**
     * Add contacts to a group (create group if it doesn't exist)
     */
    private async addContactsToGroup(client: any, addressBook: any, groupName: string, contactUIDs: string[]): Promise<void> {
        // Fetch existing vCards to find groups
        const allVCards = await client.fetchVCards({ addressBook });

        // Find existing group
        let groupVCard = allVCards.find((vcard: any) =>
            vcard.data.includes('X-ADDRESSBOOKSERVER-KIND:group') &&
            vcard.data.includes(`FN:${groupName}`)
        );

        let groupUID: string;
        let groupUrl: string;

        if (groupVCard) {
            // Extract UID from existing group
            const uidMatch = groupVCard.data.match(/UID:([^\r\n]+)/);
            groupUID = uidMatch ? uidMatch[1] : uuidv4();
            groupUrl = groupVCard.url;
            console.log(`Found existing group "${groupName}" with UID: ${groupUID}`);
        } else {
            // Create new group
            groupUID = uuidv4();
            const groupFilename = `${groupUID}.vcf`;
            groupUrl = `${addressBook.url}${groupFilename}`;
            console.log(`Creating new group "${groupName}" with UID: ${groupUID}`);
        }

        // Build group vCard with all contact members
        const now = new Date().toISOString().replace(/\.\d{3}/, '');
        let groupVCardString = 'BEGIN:VCARD\r\n';
        groupVCardString += 'VERSION:3.0\r\n';
        groupVCardString += 'PRODID:-//Apple Inc.//iOS 18.0//EN\r\n';
        groupVCardString += `N:${groupName};;;;\r\n`;
        groupVCardString += `FN:${groupName}\r\n`;

        // Add all contact UIDs as members
        contactUIDs.forEach(uid => {
            groupVCardString += `X-ADDRESSBOOKSERVER-MEMBER:urn:uuid:${uid}\r\n`;
        });

        groupVCardString += 'X-ADDRESSBOOKSERVER-KIND:group\r\n';
        groupVCardString += `REV:${now}\r\n`;
        groupVCardString += `UID:${groupUID}\r\n`;
        groupVCardString += 'END:VCARD\r\n';

        console.log('Group vCard:', groupVCardString);

        // Create or update the group
        if (groupVCard) {
            // Update existing group
            await client.updateVCard({
                vCard: {
                    url: groupUrl,
                    data: groupVCardString,
                    etag: groupVCard.etag
                }
            });
        } else {
            // Create new group
            await client.createVCard({
                addressBook: addressBook,
                filename: `${groupUID}.vcf`,
                vCardString: groupVCardString,
            });
        }
    }
}
