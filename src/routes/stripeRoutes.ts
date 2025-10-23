import { Router } from 'express';
import stripeController from '../controllers/stripeController';

const router = Router();

// Payment Intent routes
router.post('/payment-intent', stripeController.createPaymentIntent.bind(stripeController));
router.get('/payment-intent/:id', stripeController.getPaymentIntent.bind(stripeController));

// Customer routes
router.post('/customer', stripeController.createCustomer.bind(stripeController));

// Subscription routes
router.post('/subscription', stripeController.createSubscription.bind(stripeController));

// Webhook route
router.post('/webhook', stripeController.handleWebhook.bind(stripeController));

export default router;
