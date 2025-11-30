import admin from 'firebase-admin';
import fs from 'fs';
import { Contact } from '../utils/vCardHelpers';

let initialized = false;

function initFirebase() {
  if (initialized) return;

  // Support multiple auth methods: JSON env, file path, individual fields, or ADC (GOOGLE_APPLICATION_CREDENTIALS)
  const saEnv = process.env.FIREBASE_SERVICE_ACCOUNT; // JSON string, base64 JSON, or file path
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  let credential: admin.credential.Credential | undefined;

  try {
    if (saEnv) {
      let jsonStr = saEnv;
      // If FIREBASE_SERVICE_ACCOUNT points to a file path, read it
      if (!saEnv.trim().startsWith('{')) {
        try {
          if (fs.existsSync(saEnv)) {
            jsonStr = fs.readFileSync(saEnv, 'utf8');
          }
        } catch {
          // fall through; may be base64 or raw JSON string
        }
      }
      // Accept base64 or raw JSON
      if (isBase64(jsonStr)) jsonStr = Buffer.from(jsonStr, 'base64').toString('utf8');
      const serviceAccount = JSON.parse(jsonStr);
      credential = admin.credential.cert(serviceAccount);
    } else if (projectId && clientEmail && privateKey) {
      // Handle escaped newlines in env var
      privateKey = privateKey.replace(/\\n/g, '\n');
      credential = admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      } as admin.ServiceAccount);
    } else {
      // Fallback to Application Default Credentials (uses GOOGLE_APPLICATION_CREDENTIALS if set)
      credential = admin.credential.applicationDefault();
    }

    admin.initializeApp({
      credential,
      ...(process.env.FIREBASE_DATABASE_URL ? { databaseURL: process.env.FIREBASE_DATABASE_URL } : {}),
    });

    initialized = true;
  } catch (err) {
    console.error('Failed to initialize Firebase Admin:', (err as Error).message);
    throw err;
  }
}

function isBase64(str: string) {
  try {
    return Buffer.from(str, 'base64').toString('base64') === str.replace(/\s/g, '');
  } catch {
    return false;
  }
}

class FirebaseService {
  constructor() {
    initFirebase();
  }

  async getUsersFromFirestore(collection: string = 'users') {
    try {
      const db = admin.firestore();
      const snap = await db.collection(collection).get();
      const users = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      return { success: true as const, data: users };
    } catch (error) {
      return { success: false as const, error: (error as Error).message };
    }
  }

  async getUsersFromRealtime(path: string = '/users') {
    try {
      const db = admin.database();
      const snap = await db.ref(path).once('value');
      const val = snap.val();
      const data = normalizeRealtime(val);
      return { success: true as const, data };
    } catch (error) {
      return { success: false as const, error: (error as Error).message };
    }
  }

  async getContactsByIds(ids: string[], collection: string = 'contacts') {
    try {
      const db = admin.firestore();
      const refs = ids.map(id => db.collection(collection).doc(id));
      const snaps = await db.getAll(...refs);
      const contacts = snaps.map(snap => {
        if (snap.exists) {
          return { id: snap.id, ...snap.data() };
        }
        return null;
      }).filter(c => c !== null);
      return { success: true as const, data: contacts };
    } catch (error) {
      return { success: false as const, error: (error as Error).message };
    }
  }

  async batchCreateContacts(contacts: Contact[], collection: string = 'contacts') {
    try {
      const db = admin.firestore();
      const batch = db.batch();
      const collectionRef = db.collection(collection);

      contacts.forEach(contact => {
        const docRef = collectionRef.doc(); // Auto-ID
        batch.set(docRef, contact);
      });

      await batch.commit();
      return { success: true as const, count: contacts.length };
    } catch (error) {
      return { success: false as const, error: (error as Error).message };
    }
  }
}

function normalizeRealtime(val: any) {
  if (val == null) return [];
  if (Array.isArray(val)) return val.filter((v) => v != null);
  if (typeof val === 'object') {
    return Object.entries(val).map(([id, v]) => ({ id, ...(typeof v === 'object' && v ? v : { value: v }) }));
  }
  return [{ id: 'root', value: val }];
}

export default new FirebaseService();