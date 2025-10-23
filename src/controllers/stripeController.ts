import { Request, Response } from 'express';
import stripeService from '../services/stripeService';

export class StripeController {
  /**
   * Create a payment intent
   */
  async createPaymentIntent(req: Request, res: Response) {
    try {
      const { amount, currency, metadata } = req.body;

      if (!amount || typeof amount !== 'number') {
        return res.status(400).json({
          success: false,
          message: 'Amount is required and must be a number'
        });
      }

      const result = await stripeService.createPaymentIntent(amount, currency, metadata);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: result.error
        });
      }

      return res.status(200).json({
        success: true,
        data: result.data
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: (error as Error).message
      });
    }
  }

  /**
   * Get payment intent details
   */
  async getPaymentIntent(req: Request, res: Response) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Payment intent ID is required'
        });
      }

      const result = await stripeService.getPaymentIntent(id);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: result.error
        });
      }

      return res.status(200).json({
        success: true,
        data: result.data
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: (error as Error).message
      });
    }
  }

  /**
   * Create a customer
   */
  async createCustomer(req: Request, res: Response) {
    try {
      const { email, name, metadata } = req.body;

      if (!email) {
        return res.status(400).json({
          success: false,
          message: 'Email is required'
        });
      }

      const result = await stripeService.createCustomer(email, name, metadata);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: result.error
        });
      }

      return res.status(200).json({
        success: true,
        data: result.data
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: (error as Error).message
      });
    }
  }

  /**
   * Create a subscription
   */
  async createSubscription(req: Request, res: Response) {
    try {
      const { customerId, priceId, metadata } = req.body;

      if (!customerId || !priceId) {
        return res.status(400).json({
          success: false,
          message: 'Customer ID and Price ID are required'
        });
      }

      const result = await stripeService.createSubscription(customerId, priceId, metadata);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: result.error
        });
      }

      return res.status(200).json({
        success: true,
        data: result.data
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: (error as Error).message
      });
    }
  }

  /**
   * Handle webhook events
   */
  async handleWebhook(req: Request, res: Response) {
    try {
      const signature = req.headers['stripe-signature'] as string;

      if (!signature) {
        return res.status(400).json({
          success: false,
          message: 'Missing stripe-signature header'
        });
      }

      const event = stripeService.verifyWebhookSignature(req.body, signature);

      if (!event) {
        return res.status(400).json({
          success: false,
          message: 'Invalid webhook signature'
        });
      }

      // Handle different event types
      switch (event.type) {
        case 'payment_intent.succeeded':
          console.log('PaymentIntent succeeded:', event.data.object);
          break;
        case 'payment_intent.payment_failed':
          console.log('PaymentIntent failed:', event.data.object);
          break;
        case 'customer.subscription.created':
          console.log('Subscription created:', event.data.object);
          break;
        case 'customer.subscription.updated':
          console.log('Subscription updated:', event.data.object);
          break;
        case 'customer.subscription.deleted':
          console.log('Subscription deleted:', event.data.object);
          break;
        default:
          console.log(`Unhandled event type: ${event.type}`);
      }

      return res.status(200).json({ received: true });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: (error as Error).message
      });
    }
  }
}

export default new StripeController();
