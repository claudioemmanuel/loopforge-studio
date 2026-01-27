"use client";

import { useEffect, useState } from "react";
import { CheckCircle, Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

export default function SubscriptionSuccessPage() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Give Stripe webhook time to process
    const timer = setTimeout(() => {
      setLoading(false);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Processing your subscription...</p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-6">
      <div className="text-center">
        <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-8 h-8 text-green-500" />
        </div>

        <h1 className="text-2xl font-serif font-bold tracking-tight mb-2">
          Subscription Activated!
        </h1>

        <p className="text-muted-foreground mb-6">
          Thank you for subscribing. Your account has been upgraded and you now
          have access to all your new features.
        </p>

        <div className="space-y-3">
          <Link href="/dashboard" className="block">
            <Button className="w-full">
              Go to Dashboard
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>

          <Link href="/subscription" className="block">
            <Button variant="outline" className="w-full">
              View Subscription Details
            </Button>
          </Link>
        </div>

        {sessionId && (
          <p className="text-xs text-muted-foreground mt-6">
            Session ID: {sessionId.slice(0, 20)}...
          </p>
        )}
      </div>
    </div>
  );
}
