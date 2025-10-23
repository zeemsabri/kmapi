import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not defined in environment variables');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-09-30.clover'
});

export class StripeService {
  /**
   * Create a payment intent
   */
  async createPaymentIntent(amount: number, currency: string = 'usd', metadata?: Record<string, string>) {
    try {
      const paymentIntent = await stripe.paymentIntents.create({
        amount,
        currency,
        metadata,
        automatic_payment_methods: {
          enabled: true,
        },
      });
      return { success: true, data: paymentIntent };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Retrieve a payment intent
   */
  async getPaymentIntent(paymentIntentId: string) {
    try {
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      return { success: true, data: paymentIntent };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Create a customer
   */
  async createCustomer(email: string, name?: string, metadata?: Record<string, string>) {
    try {
      const customer = await stripe.customers.create({
        email,
        name,
        metadata,
      });
      return { success: true, data: customer };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Retrieve a customer
   */
  async getCustomer(customerId: string) {
    try {
      const customer = await stripe.customers.retrieve(customerId);
      return { success: true, data: customer };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Create a subscription
   */
  async createSubscription(customerId: string, priceId: string, metadata?: Record<string, string>) {
    try {
      const subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: priceId }],
        metadata,
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
        expand: ['latest_invoice.payment_intent'],
      });
      return { success: true, data: subscription };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Cancel a subscription
   */
  async cancelSubscription(subscriptionId: string) {
    try {
      const subscription = await stripe.subscriptions.cancel(subscriptionId);
      return { success: true, data: subscription };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Create a refund
   */
  async createRefund(paymentIntentId: string, amount?: number) {
    try {
      const refund = await stripe.refunds.create({
        payment_intent: paymentIntentId,
        ...(amount && { amount }),
      });
      return { success: true, data: refund };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload: string | Buffer, signature: string): Stripe.Event | null {
    try {
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
      if (!webhookSecret) {
        throw new Error('STRIPE_WEBHOOK_SECRET is not defined');
      }
      const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
      return event;
    } catch (error) {
      console.error('Webhook signature verification failed:', (error as Error).message);
      return null;
    }
  }
}

export default new StripeService();
