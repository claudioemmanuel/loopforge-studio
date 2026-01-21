"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { XCircle, ArrowLeft, HelpCircle } from "lucide-react";

export default function SubscriptionCancelPage() {
  const router = useRouter();

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <Card className="max-w-md w-full text-center">
        <CardHeader className="pb-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <XCircle className="w-8 h-8 text-muted-foreground" />
          </div>
          <CardTitle className="text-2xl">Checkout Canceled</CardTitle>
          <CardDescription>
            No worries! You can subscribe anytime.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-sm text-muted-foreground">
            Your payment was not processed and you have not been charged.
            When you&apos;re ready, you can subscribe to start using Loopforge&apos;s
            AI-powered coding features.
          </p>

          <div className="space-y-3">
            <Button onClick={() => router.push("/subscription")} className="w-full">
              <ArrowLeft className="w-4 h-4 mr-2" />
              View Plans
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push("/")}
              className="w-full"
            >
              Go to Dashboard
            </Button>
          </div>

          <div className="pt-4 border-t">
            <a
              href="mailto:support@loopforge.dev"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <HelpCircle className="w-4 h-4" />
              Need help? Contact support
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
