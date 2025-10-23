# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Development Commands

### Setup
```bash
npm install                    # Install dependencies
cp .env.example .env          # Create environment file (must configure Stripe keys)
```

### Running the Application
```bash
npm run dev                    # Start development server with hot reload
npm start                      # Start production server (requires build first)
npm run build                  # Compile TypeScript to JavaScript (outputs to dist/)
```

### Code Quality
```bash
npm run lint                   # Run TypeScript type checking (tsc --noEmit)
```

**Note**: No test suite is currently configured. The `npm test` command will fail.

## Architecture Overview

### Application Structure
This is a Node.js/Express API with TypeScript, following a layered architecture pattern:

```
Request → Routes → Controllers → Services → External APIs (Stripe)
```

**Key layers:**
- **Routes** (`src/routes/`): Define API endpoints and bind controller methods
- **Controllers** (`src/controllers/`): Handle HTTP request/response, validate input, call services
- **Services** (`src/services/`): Contain business logic and external API interactions
- **Server** (`src/server.ts`): Express app configuration with middleware stack

### Entry Point Flow
1. `src/index.ts` - Entry point that imports server.ts
2. `src/server.ts` - Configures Express app with middleware (helmet, cors, morgan) and routes, then starts listening

### Stripe Integration
The application uses a singleton pattern for Stripe service (`stripeService`). The service is instantiated once and exported, with methods that return objects with `{ success, data?, error? }` structure.

**Stripe API version**: `2024-12-18.acacia` (hardcoded in stripeService.ts)

**Available operations:**
- Payment Intents (create, retrieve)
- Customers (create, retrieve)
- Subscriptions (create, cancel)
- Refunds (create)
- Webhook signature verification

### API Response Format
All endpoints follow a consistent response structure:
```typescript
{
  success: boolean,
  data?: any,        // On success
  message?: string   // On error
}
```

### Environment Variables
Required for operation:
- `STRIPE_SECRET_KEY` - Required, app will throw on startup if missing
- `STRIPE_WEBHOOK_SECRET` - Required for webhook verification
- `STRIPE_PUBLISHABLE_KEY` - Defined in .env.example but not used in code

Optional:
- `PORT` (default: 3000)
- `NODE_ENV` (default: development)
- `ALLOWED_ORIGINS` - Comma-separated for CORS
- `API_VERSION` - Defined in .env.example but not used in code

### Middleware Stack
Applied in order:
1. `helmet()` - Security headers
2. `morgan('dev')` - HTTP request logging
3. `cors()` - Configured with ALLOWED_ORIGINS or '*'
4. `express.json()` - JSON body parsing
5. `express.urlencoded()` - URL-encoded body parsing

### Error Handling
- Global error handler catches all errors and returns 500 responses
- In development mode, error stack traces are included in responses
- Service methods catch errors and return `{ success: false, error }` objects

### Extensibility Notes
The codebase is structured to accommodate future services beyond Stripe:
- Dedicated directories exist for `config/` and `middleware/` (currently empty)
- Route structure supports additional service routes alongside `/api/stripe`
- Service layer pattern can be replicated for other integrations

## Development Guidelines

### When Adding New Stripe Features
1. Add method to `StripeService` class following existing pattern (try/catch with success/error object)
2. Add controller method to `StripeController` with input validation
3. Add route to `stripeRoutes.ts` with proper HTTP verb
4. Test with appropriate Stripe test mode credentials

### When Adding Non-Stripe Services
1. Create new service file in `src/services/`
2. Create corresponding controller in `src/controllers/`
3. Create route file in `src/routes/`
4. Register routes in `src/server.ts`
5. Follow the existing layered architecture pattern

### TypeScript Configuration
- Strict mode enabled with additional checks (noUnusedLocals, noUnusedParameters, noImplicitReturns)
- CommonJS module system
- Target: ES2020
- Always run `npm run lint` before committing to catch type errors
