import { Request, Response } from 'express';
import firebaseService from '../services/firebaseService';

class UsersController {
  async getUsers(req: Request, res: Response) {
    try {
      const source = (req.query.source as string) || (process.env.FIREBASE_DB_TYPE || 'firestore');

      const result = source === 'realtime'
        ? await firebaseService.getUsersFromRealtime(process.env.FIREBASE_RT_USERS_PATH || '/users')
        : await firebaseService.getUsersFromFirestore(process.env.FIRESTORE_USERS_COLLECTION || 'users');

      if (!result.success) {
        return res.status(500).json({ success: false, message: result.error });
      }

      return res.status(200).json({ success: true, data: result.data });
    } catch (error) {
      return res.status(500).json({ success: false, message: (error as Error).message });
    }
  }
}

export default new UsersController();