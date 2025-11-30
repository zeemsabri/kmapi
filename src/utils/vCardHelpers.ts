import vCardParser from 'vcard-parser';

export interface Contact {
  firstName: string;
  lastName: string;
  phone?: string;
  email?: string;
  firebaseId?: string; // Firebase document ID for tracking
}

export const jsonToVCard = (contact: Contact, uid: string): string => {
  const { firstName, lastName, phone, email, firebaseId } = contact;

  // Ensure we have at least some name data
  const effectiveFirstName = firstName || '';
  const effectiveLastName = lastName || '';

  // Create a meaningful display name - use phone or email as fallback if no name
  let fn = `${effectiveFirstName} ${effectiveLastName}`.trim();
  if (!fn && phone) {
    fn = phone;
  } else if (!fn && email) {
    fn = email;
  } else if (!fn) {
    fn = 'Unknown Contact';
  }

  // N format: LastName;FirstName;MiddleName;Prefix;Suffix
  let n: string;
  if (!effectiveFirstName && !effectiveLastName && (phone || email)) {
    n = `;${fn};;;`;
  } else {
    n = `${effectiveLastName};${effectiveFirstName};;;`;
  }

  // Current timestamp in vCard format (YYYY-MM-DDTHH:MM:SSZ)
  const now = new Date().toISOString().replace(/\.\d{3}/, '');

  // Build vCard matching Apple's exact format
  let vCard = 'BEGIN:VCARD\r\n';
  vCard += 'VERSION:3.0\r\n';
  vCard += 'PRODID:-//Apple Inc.//iOS 18.0//EN\r\n'; // Match Apple's format
  vCard += `N:${n}\r\n`;
  vCard += `FN:${fn}\r\n`;

  // Add KMYC as organization (with trailing semicolon per Apple format)
  vCard += 'ORG:KMYC;\r\n';

  // Contact information - match Apple's exact format
  if (phone) {
    // Apple format: lowercase 'type', multiple attributes, type=pref for primary
    vCard += `TEL;type=CELL;type=VOICE;type=pref:${phone}\r\n`;
  }

  if (email) {
    vCard += `EMAIL;type=INTERNET;type=pref:${email}\r\n`;
  }

  // Add Firebase ID as custom field for tracking
  if (firebaseId) {
    vCard += `X-FIREBASE-ID:${firebaseId}\r\n`;
  }

  // Metadata fields
  vCard += `REV:${now}\r\n`;
  vCard += `UID:${uid}\r\n`;
  vCard += 'END:VCARD\r\n';

  return vCard;
};

export const vCardToJson = (vcardString: string): Contact => {
  const parsed = vCardParser.parse(vcardString);

  // vCardParser returns an object where keys are fields and values are arrays of objects
  // e.g. { n: [ { value: ['LastName', 'FirstName', ...] } ], tel: [ { value: '...' } ] }

  const n = parsed.n ? parsed.n[0].value : [];
  const lastName = n[0] || '';
  const firstName = n[1] || '';

  const phone = parsed.tel ? parsed.tel[0].value : undefined;
  const email = parsed.email ? parsed.email[0].value : undefined;

  return {
    firstName,
    lastName,
    phone,
    email
  };
};
