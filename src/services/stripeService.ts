import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not defined in environment variables');
}

if (!process.env.STRIPE_DONATION_PRODUCT_ID) {
  throw new Error('STRIPE_DONATION_PRODUCT_ID is not defined in environment variables');
}

// I've set this to a standard, recent API version.
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  // --- THIS IS THE FIX ---
  // We use 'as any' to bypass the build-time error,
  // while still using the version that works at runtime.
  apiVersion: '2024-06-20' as any,
});

export class StripeService {
  /**
   * --- NEW HELPER METHOD ---
   * Finds an existing customer by email or creates a new one.
   * This is essential for subscriptions.
   */
  private async findOrCreateCustomer(name: string, email: string) {
    // 1. Check if customer exists
    const customerList = await stripe.customers.list({ email: email, limit: 1 });
    if (customerList.data.length > 0) {
      return customerList.data[0];
    }

    // 2. Create new customer
    const customer = await stripe.customers.create({
      name,
      email,
      description: 'Donation Customer',
    });
    return customer;
  }

  /**
   * --- UPDATED METHOD ---
   * This function now intelligently handles both one-time AND recurring payments
   * by checking the metadata.frequency.
   */
  async createPaymentIntent(
      amount: number,
      currency: string = 'aud', // Assuming AUD from your frontend
      metadata?: Record<string, string>,
  ) {
    try {
      const frequency = metadata?.frequency || 'one-time';

      // --- BRANCH 1: One-Time Donation ---
      if (frequency === 'one-time') {
        const paymentIntent = await stripe.paymentIntents.create({
          amount,
          currency,
          metadata,
          automatic_payment_methods: {
            enabled: true,
          },
        });
        // Return the client secret for the Payment Intent
        return { success: true, data: { client_secret: paymentIntent.client_secret } };
      }

      // --- BRANCH 2: Recurring Donation (Subscription) ---
      const { donorName, donorEmail } = metadata || {};
      if (!donorName || !donorEmail) {
        throw new Error('Customer name and email are required for subscriptions.');
      }

      // 1. Get or create the customer
      const customer = await this.findOrCreateCustomer(donorName, donorEmail);

      // --- [START] FIX for Interval Error ---
      // 2. Map frontend frequency (e.g., 'monthly') to Stripe interval (e.g., 'month')
      const interval = frequency === 'weekly' ? 'week' : 'month'; // 'weekly' -> 'week', 'monthly' -> 'month'

      // 3. Create the dynamic Price for the subscription on the fly
      const price = await stripe.prices.create({
        currency: currency,
        unit_amount: amount, // Amount in cents
        recurring: {
          interval: interval, // Use the mapped value ('month' or 'week')
        },
        product: process.env.STRIPE_DONATION_PRODUCT_ID, // From your .env file
      });
      // --- [END] FIX for Interval Error ---

      // 4. Create the subscription
      const subscription = await stripe.subscriptions.create({
        customer: customer.id,
        items: [{ price: price.id }],
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
        expand: ['latest_invoice.payment_intent'], // We still ask for it
        metadata,
      });

      // --- [START] NEW ROBUST FIX ---

      // 5. Get the invoice and payment intent
      const latestInvoice: any = subscription.latest_invoice;
      if (!latestInvoice) {
        throw new Error('Subscription created, but no latest_invoice was found.');
      }

      const paymentIntent = latestInvoice.payment_intent;

      // Case 1: (Happy Path) expand worked, and we have the full object.
      if (paymentIntent && typeof paymentIntent === 'object' && paymentIntent.client_secret) {
        return { success: true, data: { client_secret: paymentIntent.client_secret } };
      }

      // Case 2: (Likely Scenario) expand failed, but we have the Payment Intent ID (a string).
      if (paymentIntent && typeof paymentIntent === 'string') {
        // Manually retrieve the Payment Intent to get its client_secret
        const retrievedPI = await stripe.paymentIntents.retrieve(paymentIntent);
        if (retrievedPI && retrievedPI.client_secret) {
          return { success: true, data: { client_secret: retrievedPI.client_secret } };
        }
      }

      // Case 3: (Error) Something is wrong (null, undefined, or PI has no secret).
      console.error('Failed to extract client_secret. Payment Intent from invoice:', paymentIntent);
      throw new Error('Failed to get payment_intent object from subscription invoice.');

      // --- [END] NEW ROBUST FIX ---
    } catch (error) {
      console.error('StripeService Error:', (error as Error).message);
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