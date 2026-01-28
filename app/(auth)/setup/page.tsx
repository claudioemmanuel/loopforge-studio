"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { clientLogger } from "@/lib/logger";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CheckCircle2, Copy, ExternalLink } from "lucide-react";
import { LoopforgeLogo } from "@/components/loopforge-logo";

interface SetupStatus {
  configured: boolean;
  callbackUrl: string;
}

export default function SetupPage() {
  const router = useRouter();
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const checkSetupStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/setup/status");
      const data = await res.json();
      setStatus(data);

      // If already configured, redirect to login
      if (data.configured) {
        router.push("/login");
      }
    } catch (error) {
      clientLogger.error("Failed to check setup status", { error });
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    checkSetupStatus();
  }, [checkSetupStatus]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background to-secondary/30">
        <div className="text-muted-foreground">Checking configuration...</div>
      </main>
    );
  }

  if (status?.configured) {
    return null; // Will redirect
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background to-secondary/30">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto">
            <LoopforgeLogo
              size="xl"
              animate={true}
              showSparks={true}
              showText={true}
            />
          </div>
          <CardTitle className="text-2xl font-serif">Platform Setup</CardTitle>
          <CardDescription>
            Configure GitHub OAuth to enable user authentication
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Step 1 */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
                1
              </div>
              <h3 className="font-medium">Create GitHub OAuth App</h3>
            </div>
            <div className="ml-8 space-y-2">
              <p className="text-sm text-muted-foreground">
                Go to GitHub Developer Settings and create a new OAuth App:
              </p>
              <Button variant="outline" size="sm" asChild>
                <a
                  href="https://github.com/settings/developers"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2"
                >
                  Open GitHub Developer Settings
                  <ExternalLink className="w-4 h-4" />
                </a>
              </Button>
            </div>
          </div>

          {/* Step 2 */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
                2
              </div>
              <h3 className="font-medium">Configure OAuth App Settings</h3>
            </div>
            <div className="ml-8 space-y-3">
              <div className="p-4 bg-muted rounded-lg space-y-3">
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                    Application Name
                  </div>
                  <code className="text-sm">Loopforge</code>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                    Homepage URL
                  </div>
                  <code className="text-sm">
                    {status?.callbackUrl?.replace(
                      "/api/auth/callback/github",
                      "",
                    ) || "http://localhost:3000"}
                  </code>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                    Authorization Callback URL
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="text-sm flex-1 break-all">
                      {status?.callbackUrl ||
                        "http://localhost:3000/api/auth/callback/github"}
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(status?.callbackUrl || "")}
                    >
                      {copied ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Step 3 */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
                3
              </div>
              <h3 className="font-medium">Add Environment Variables</h3>
            </div>
            <div className="ml-8 space-y-2">
              <p className="text-sm text-muted-foreground">
                Copy the Client ID and Client Secret from GitHub and add them to
                your environment:
              </p>
              <div className="p-4 bg-muted rounded-lg font-mono text-sm space-y-1">
                <div>GITHUB_CLIENT_ID=your_client_id_here</div>
                <div>GITHUB_CLIENT_SECRET=your_client_secret_here</div>
              </div>
              <p className="text-xs text-muted-foreground">
                For Docker: Add these to your <code>.env</code> file and restart
                the containers.
              </p>
            </div>
          </div>

          {/* Step 4 */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
                4
              </div>
              <h3 className="font-medium">Restart and Verify</h3>
            </div>
            <div className="ml-8 space-y-2">
              <p className="text-sm text-muted-foreground">
                After adding the environment variables, restart Loopforge and
                refresh this page.
              </p>
              <Button onClick={() => window.location.reload()}>
                Check Configuration
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
