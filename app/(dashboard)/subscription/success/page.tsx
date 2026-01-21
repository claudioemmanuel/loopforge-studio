"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Loader2, ArrowRight, Sparkles } from "lucide-react";

export default function SubscriptionSuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Wait a moment for webhook to process
    const timer = setTimeout(() => {
      setLoading(false);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  const sessionId = searchParams.get("session_id");

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <Card className="max-w-md w-full text-center">
        <CardHeader className="pb-4">
          {loading ? (
            <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
          ) : (
            <div className="mx-auto w-16 h-16 rounded-full bg-green-100 dark:bg-green-950 flex items-center justify-center mb-4">
              <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
          )}
          <CardTitle className="text-2xl">
            {loading ? "Processing..." : "Welcome to Loopforge!"}
          </CardTitle>
          <CardDescription>
            {loading
              ? "Setting up your subscription..."
              : "Your subscription is now active"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {!loading && (
            <>
              <div className="p-4 bg-muted rounded-lg text-left space-y-3">
                <div className="flex items-start gap-3">
                  <Sparkles className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <div className="font-medium">AI-Powered Coding</div>
                    <div className="text-sm text-muted-foreground">
                      Start creating tasks and let AI handle the implementation
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <Button onClick={() => router.push("/")} className="w-full">
                  Go to Dashboard
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
                <Button
                  variant="outline"
                  onClick={() => router.push("/subscription")}
                  className="w-full"
                >
                  View Subscription
                </Button>
              </div>

              <p className="text-xs text-muted-foreground">
                You can manage your subscription anytime from the settings page.
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
