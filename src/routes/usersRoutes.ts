import { Router } from 'express';
import usersController from '../controllers/usersController';

const router = Router();

// GET /users
router.get('/', usersController.getUsers.bind(usersController));

export default router;