import { NextResponse } from "next/server";
import Stripe from "stripe";
import {
  verifyWebhookSignature,
  handleCheckoutCompleted,
  handleSubscriptionUpdated,
  handleSubscriptionDeleted,
  handlePaymentFailed,
  isStripeConfigured,
} from "@/lib/billing";
import { handleError, Errors } from "@/lib/errors";

export async function POST(request: Request) {
  if (!isStripeConfigured()) {
    return handleError(Errors.invalidRequest("Stripe is not configured"));
  }

  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return handleError(
      Errors.invalidRequest("Missing stripe-signature header"),
    );
  }

  try {
    const body = await request.text();
    const event = await verifyWebhookSignature(body, signature);

    if ("error" in event) {
      console.error("Webhook verification failed:", event.error);
      return handleError(Errors.invalidRequest(event.error));
    }

    // Handle the event
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(session);
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdated(subscription);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentFailed(invoice);
        break;
      }

      default:
        // Unhandled event type - that's okay, just acknowledge it
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    return handleError(error);
  }
}

// Stripe webhooks need raw body, disable body parsing
export const config = {
  api: {
    bodyParser: false,
  },
};
