import { Request, Response } from 'express';
import admin from 'firebase-admin';
import firebaseService from '../services/firebaseService';

// Ensure Firebase Admin is initialized via firebaseService side effect
void firebaseService;

function getClientIp(req: Request): string {
  const xff = (req.headers['x-forwarded-for'] || req.headers['X-Forwarded-For']) as string | undefined;
  if (xff && typeof xff === 'string') {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }
  // Fallbacks
  const ip = (req.socket.remoteAddress || req.ip || '').replace('::ffff:', '');
  return ip || 'unknown';
}

class AuthController {
  /**
   * POST /api/v1/auth/pin-login
   */
  async pinLogin(req: Request, res: Response) {
    try {
      const db = admin.firestore();
      const { pin, email } = req.body as { pin?: string; email?: string };
      const ip = getClientIp(req);

      const attemptsRef = db.collection('loginAttempts').doc(ip);
      const attemptsSnap = await attemptsRef.get();
      const attemptsData = attemptsSnap.exists
        ? (attemptsSnap.data() as { failedPinAttempts?: number; requiresEmail?: boolean })
        : { failedPinAttempts: 0, requiresEmail: false };

      const requiresEmail = !!attemptsData.requiresEmail;

      // Validation based on friction state
      if (requiresEmail) {
        if (!pin || !email) {
          return res.status(401).json({
            success: false,
            error: 'EMAIL_REQUIRED',
            message: 'Too many failed attempts. Please provide email and PIN.'
          });
        }
      } else {
        if (!pin) {
          return res.status(400).json({ success: false, message: 'PIN is required.' });
        }
      }

      // Query users collection
      const usersCol = db.collection('users');
      let userSnap: FirebaseFirestore.QuerySnapshot<FirebaseFirestore.DocumentData>;
      if (requiresEmail) {
        userSnap = await usersCol.where('email', '==', email).where('pin', '==', pin).limit(1).get();
      } else {
        userSnap = await usersCol.where('pin', '==', pin).limit(1).get();
      }

      if (!userSnap.empty) {
        // Success handler
        const userDoc = userSnap.docs[0];
        const userId = userDoc.id;
        const token = await admin.auth().createCustomToken(userId);
        // Reset attempts
        await attemptsRef.delete().catch(() => undefined);
        return res.status(200).json({ success: true, token });
      }

      // Failure handler
      if (!requiresEmail) {
        const nextFailed = (attemptsData.failedPinAttempts || 0) + 1;
        const escalated = nextFailed >= 3;

        await attemptsRef.set(
          {
            failedPinAttempts: nextFailed,
            requiresEmail: escalated ? true : attemptsData.requiresEmail || false,
          },
          { merge: true }
        );

        if (escalated) {
          return res.status(401).json({
            success: false,
            error: 'EMAIL_REQUIRED',
            message: 'Too many failed attempts. Please provide email and PIN.'
          });
        }

        return res.status(401).json({ success: false, message: 'Invalid PIN.' });
      }

      // Already escalated: do not change counters, just respond
      return res.status(401).json({ success: false, message: 'Invalid email or PIN.' });
    } catch (error) {
      return res.status(500).json({ success: false, message: (error as Error).message });
    }
  }
}

export default new AuthController();