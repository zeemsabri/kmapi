import { Router } from 'express';
import authController from '../controllers/authController';

const router = Router();

router.post('/pin-login', authController.pinLogin.bind(authController));

export default router;