# KM Backend API

Node.js backend API application for handling Stripe payments and future services.

## Features

- **Stripe Integration**: Complete payment processing with Stripe API
  - Payment Intents
  - Customer Management
  - Subscriptions
  - Webhooks
- **TypeScript**: Full type safety
- **Express.js**: Fast and minimal web framework
- **Security**: Helmet middleware for security headers
- **CORS**: Configurable cross-origin resource sharing
- **Logging**: Morgan for HTTP request logging

## Project Structure

```
km-backend-api/
├── src/
│   ├── config/          # Configuration files
│   ├── controllers/     # Request handlers
│   ├── middleware/      # Custom middleware
│   ├── routes/          # API routes
│   ├── services/        # Business logic
│   ├── index.ts         # Entry point
│   └── server.ts        # Express server setup
├── dist/                # Compiled JavaScript
├── .env.example         # Environment variables template
├── tsconfig.json        # TypeScript configuration
└── package.json         # Project dependencies
```

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Stripe account

### Installation

1. Clone the repository or navigate to the project directory:
   ```bash
   cd km-backend-api
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   ```

4. Edit `.env` file with your configuration:
   ```env
   PORT=3000
   NODE_ENV=development
   STRIPE_SECRET_KEY=your_stripe_secret_key
   STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
   STRIPE_WEBHOOK_SECRET=your_webhook_secret
   ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
   ```

### Development

Start the development server with hot reload:

```bash
npm run dev
```

The server will start on `http://localhost:3000` (or your configured PORT).

### Production

1. Build the project:
   ```bash
   npm run build
   ```

2. Start the production server:
   ```bash
   npm start
   ```

## API Endpoints

### Health Check

- `GET /api/health` - Check API status

### Stripe Endpoints

#### Payment Intents
- `POST /api/stripe/payment-intent` - Create a payment intent
  ```json
  {
    "amount": 1000,
    "currency": "usd",
    "metadata": {}
  }
  ```
- `GET /api/stripe/payment-intent/:id` - Get payment intent details

#### Customers
- `POST /api/stripe/customer` - Create a customer
  ```json
  {
    "email": "customer@example.com",
    "name": "John Doe",
    "metadata": {}
  }
  ```

#### Subscriptions
- `POST /api/stripe/subscription` - Create a subscription
  ```json
  {
    "customerId": "cus_xxx",
    "priceId": "price_xxx",
    "metadata": {}
  }
  ```

#### Webhooks
- `POST /api/stripe/webhook` - Handle Stripe webhook events

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `PORT` | Server port | No (default: 3000) |
| `NODE_ENV` | Environment mode | No (default: development) |
| `STRIPE_SECRET_KEY` | Stripe secret API key | Yes |
| `STRIPE_PUBLISHABLE_KEY` | Stripe publishable key | Yes |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook secret | Yes |
| `ALLOWED_ORIGINS` | Comma-separated CORS origins | No |
| `API_VERSION` | API version prefix | No (default: v1) |

## Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Compile TypeScript to JavaScript
- `npm start` - Start production server
- `npm run lint` - Run TypeScript type checking

## Security

- Uses Helmet.js for security headers
- Environment variables for sensitive data
- CORS configuration for allowed origins
- Webhook signature verification

## Future Enhancements

This API is designed to be extensible for future services beyond Stripe:

- Authentication & Authorization
- Database integration
- Additional payment providers
- Email services
- File upload/storage
- Analytics
- And more...

## License

ISC
