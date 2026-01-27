"use client";

import { XCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function SubscriptionCancelPage() {
  return (
    <div className="max-w-md mx-auto p-6">
      <div className="text-center">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
          <XCircle className="w-8 h-8 text-muted-foreground" />
        </div>

        <h1 className="text-2xl font-serif font-bold tracking-tight mb-2">
          Checkout Cancelled
        </h1>

        <p className="text-muted-foreground mb-6">
          Your checkout was cancelled and you have not been charged. You can try
          again whenever you are ready.
        </p>

        <div className="space-y-3">
          <Link href="/subscription" className="block">
            <Button className="w-full">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Plans
            </Button>
          </Link>

          <Link href="/dashboard" className="block">
            <Button variant="outline" className="w-full">
              Go to Dashboard
            </Button>
          </Link>
        </div>

        <p className="text-sm text-muted-foreground mt-6">
          Have questions?{" "}
          <a
            href="https://github.com/claudioemmanuel/loopforge-studio/issues"
            className="text-primary hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Contact support
          </a>
        </p>
      </div>
    </div>
  );
}
