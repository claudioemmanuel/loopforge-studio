// Billing library exports
export {
  // Token pricing
  calculateTokenCost,
  // Usage tracking
  recordUsage,
  // Usage summary
  getUsageSummary,
  type UsageSummary,
  // Limit checks
  canCreateTask,
  canExecuteTask,
  canAddRepo,
  // Formatters
  formatTokens,
  formatCost,
} from "./usage";

export {
  // Middleware
  checkBillingLimits,
  withBillingCheck,
  type LimitType,
} from "./middleware";

export {
  // Stripe client
  stripe,
  // Checkout
  createCheckoutSession,
  type CreateCheckoutParams,
  // Portal
  createPortalSession,
  // Webhooks
  verifyWebhookSignature,
  handleCheckoutCompleted,
  handleSubscriptionUpdated,
  handleSubscriptionDeleted,
  handlePaymentFailed,
  type WebhookEvent,
  // Helpers
  isStripeConfigured,
  getPublishableKey,
} from "./stripe-client";
