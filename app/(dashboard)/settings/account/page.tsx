"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  CreditCard,
  ExternalLink,
  Loader2,
  User,
} from "lucide-react";
import { useSettings } from "../settings-context";

export default function AccountPage() {
  const { user, subscription } = useSettings();
  const [managingSubscription, setManagingSubscription] = useState(false);

  const handleManageSubscription = async () => {
    setManagingSubscription(true);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      if (res.ok) {
        const { url } = await res.json();
        window.location.href = url;
      }
    } catch (error) {
      console.error("Failed to open billing portal:", error);
    } finally {
      setManagingSubscription(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Profile */}
      <div className="p-6 rounded-xl border bg-card">
        <div className="flex items-center gap-2 mb-4">
          <User className="w-4 h-4" />
          <h3 className="font-serif font-semibold tracking-tight">Profile</h3>
        </div>
        <div className="flex items-center gap-4">
          {user.image ? (
            <img
              src={user.image}
              alt={user.name || ""}
              className="w-16 h-16 rounded-full"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center text-xl font-semibold">
              {user.name?.[0] || "U"}
            </div>
          )}
          <div>
            <p className="font-semibold text-lg">{user.name}</p>
            <p className="text-muted-foreground">{user.email}</p>
          </div>
        </div>
      </div>

      {/* Subscription */}
      <div className="p-6 rounded-xl border bg-card">
        <div className="flex items-center gap-2 mb-4">
          <CreditCard className="w-4 h-4" />
          <h3 className="font-serif font-semibold tracking-tight">
            Billing and Subscription
          </h3>
        </div>
        {subscription ? (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="font-medium">Current plan: {subscription.plan}</p>
                {subscription.nextBilling && (
                  <p className="text-sm text-muted-foreground">
                    Next billing: {subscription.nextBilling}
                  </p>
                )}
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>
                  Usage: {subscription.usage}/{subscription.limit} tasks
                </span>
                <span>
                  {Math.round((subscription.usage / subscription.limit) * 100)}%
                </span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full"
                  style={{
                    width: `${(subscription.usage / subscription.limit) * 100}%`,
                  }}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleManageSubscription}
                disabled={managingSubscription}
              >
                {managingSubscription ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Opening...
                  </>
                ) : (
                  <>
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Manage Subscription
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <p className="text-sm text-muted-foreground mb-3">
              You&apos;re using Bring Your Own Key mode. Upgrade for managed
              billing.
            </p>
            <Link href="/subscription">
              <Button size="sm">Upgrade Plan</Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
