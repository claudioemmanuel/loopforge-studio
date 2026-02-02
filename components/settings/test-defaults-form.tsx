"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, TestTube2, Info } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useTranslations } from "next-intl";
import { Alert, AlertDescription } from "@/components/ui/alert";

type TestGatePolicy = "strict" | "warn" | "skip" | "autoApprove";

interface TestDefaults {
  defaultTestCommand: string | null;
  defaultTestTimeout: number;
  defaultTestGatePolicy: TestGatePolicy;
}

const gatePolicyOptions: TestGatePolicy[] = [
  "strict",
  "warn",
  "skip",
  "autoApprove",
];

export function TestDefaultsForm() {
  const t = useTranslations("settings.workflowPage.testDefaults");
  const tCommon = useTranslations("settings.workflowPage");
  const [testCommand, setTestCommand] = useState("");
  const [testTimeout, setTestTimeout] = useState(300000); // 5 minutes default
  const [gatePolicy, setGatePolicy] = useState<TestGatePolicy>("warn");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  // Fetch current configuration
  useEffect(() => {
    async function fetchConfig() {
      try {
        const res = await fetch("/api/settings/test-defaults");
        const data: TestDefaults = await res.json();
        setTestCommand(data.defaultTestCommand || "");
        setTestTimeout(data.defaultTestTimeout || 300000);
        setGatePolicy(data.defaultTestGatePolicy || "warn");
      } catch (error) {
        console.error("Failed to fetch test defaults:", error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchConfig();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch("/api/settings/test-defaults", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          defaultTestCommand: testCommand || null,
          defaultTestTimeout: testTimeout,
          defaultTestGatePolicy: gatePolicy,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save configuration");
      }

      toast({
        title: tCommon("configurationSaved"),
        description: tCommon("testDefaultsUpdated"),
      });
    } catch (error) {
      toast({
        title: tCommon("failedToSave"),
        description:
          error instanceof Error ? error.message : tCommon("unknownError"),
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const timeoutInSeconds = Math.floor(testTimeout / 1000);
  const timeoutInMinutes = Math.floor(timeoutInSeconds / 60);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Test Defaults Configuration */}
      <div className="p-6 rounded-xl border bg-card">
        <div className="flex items-center gap-2 mb-4">
          <TestTube2 className="w-4 h-4" />
          <h3 className="font-serif font-semibold tracking-tight">
            {t("title")}
          </h3>
        </div>

        <Alert className="mb-6">
          <Info className="h-4 w-4" />
          <AlertDescription>{t("description")}</AlertDescription>
        </Alert>

        <div className="space-y-6">
          {/* Test Command */}
          <div className="space-y-2">
            <Label htmlFor="test-command">{t("command")}</Label>
            <Input
              id="test-command"
              placeholder={t("commandPlaceholder")}
              value={testCommand}
              onChange={(e) => setTestCommand(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {t("commandDescription")}
            </p>
          </div>

          {/* Test Timeout */}
          <div className="space-y-2">
            <Label htmlFor="test-timeout">{t("timeout")}</Label>
            <div className="flex gap-2 items-center">
              <Input
                id="test-timeout"
                type="number"
                min={30}
                max={3600}
                step={30}
                value={timeoutInSeconds}
                onChange={(e) =>
                  setTestTimeout(parseInt(e.target.value) * 1000)
                }
                className="w-32"
              />
              <span className="text-sm text-muted-foreground">
                {t("timeoutSeconds", {
                  seconds: timeoutInSeconds,
                  minutes: timeoutInMinutes,
                })}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {t("timeoutDescription")}
            </p>
          </div>

          {/* Test Gate Policy - Radio Group */}
          <div className="space-y-3">
            <Label>{t("gatePolicy")}</Label>
            <p className="text-xs text-muted-foreground">
              {t("gatePolicyDescription")}
            </p>
            <div className="space-y-3">
              {gatePolicyOptions.map((policy) => (
                <label
                  key={policy}
                  className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-accent transition-colors"
                >
                  <input
                    type="radio"
                    name="gate-policy"
                    value={policy}
                    checked={gatePolicy === policy}
                    onChange={(e) =>
                      setGatePolicy(e.target.value as TestGatePolicy)
                    }
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="font-medium">
                      {t(`gatePolicyOptions.${policy}`)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {t(`gatePolicyOptions.${policy}Description`)}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="pt-4">
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {tCommon("saving")}
                </>
              ) : (
                tCommon("saveConfiguration")
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
