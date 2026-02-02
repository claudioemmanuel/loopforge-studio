"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Check, X, Loader2, FolderOpen } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useTranslations } from "next-intl";
import { TestDefaultsForm } from "@/components/settings/test-defaults-form";

export default function WorkflowSettingsPage() {
  const t = useTranslations("settings.workflowPage");
  const [cloneDirectory, setCloneDirectory] = useState("");
  const [expandedPath, setExpandedPath] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [validation, setValidation] = useState<{
    valid: boolean;
    exists: boolean;
    writable: boolean;
    error?: string;
  } | null>(null);
  const { toast } = useToast();

  // Fetch current configuration
  useEffect(() => {
    async function fetchConfig() {
      try {
        const res = await fetch("/api/settings/clone-directory");
        const data = await res.json();
        if (data.cloneDirectory) {
          setCloneDirectory(data.cloneDirectory);
          setExpandedPath(data.expanded);
        }
      } catch (error) {
        console.error("Failed to fetch clone directory:", error);
      }
    }
    fetchConfig();
  }, []);

  // Validate path with debounce
  useEffect(() => {
    if (!cloneDirectory) {
      setValidation(null);
      setExpandedPath("");
      return;
    }

    const timeoutId = setTimeout(async () => {
      setIsValidating(true);
      try {
        const res = await fetch("/api/settings/clone-directory/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: cloneDirectory }),
        });
        const data = await res.json();
        setExpandedPath(data.expanded);
        setValidation(data.validation);
      } catch (error) {
        console.error("Validation failed:", error);
        setValidation({
          valid: false,
          exists: false,
          writable: false,
          error: "Failed to validate path",
        });
      } finally {
        setIsValidating(false);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [cloneDirectory]);

  const handleSave = async () => {
    if (!validation?.valid) {
      toast({
        title: t("invalidDirectory"),
        description: validation?.error || t("pleaseEnterValid"),
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch("/api/settings/clone-directory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cloneDirectory }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save configuration");
      }

      toast({
        title: t("configurationSaved"),
        description: t("cloneDirectoryUpdated"),
      });
    } catch (error) {
      toast({
        title: t("failedToSave"),
        description: error instanceof Error ? error.message : t("unknownError"),
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const commonPaths = [
    { label: "~/Documents/GitHub", path: "~/Documents/GitHub" },
    { label: "~/Projects", path: "~/Projects" },
    { label: "~/Developer", path: "~/Developer" },
    { label: "~/Code", path: "~/Code" },
  ];

  return (
    <Tabs defaultValue="clone-directory" className="space-y-6">
      <TabsList className="grid w-full max-w-md grid-cols-2">
        <TabsTrigger value="clone-directory">
          {t("tabs.cloneDirectory")}
        </TabsTrigger>
        <TabsTrigger value="test-defaults">
          {t("tabs.testDefaults")}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="clone-directory" className="space-y-6">
        {/* Clone Directory Configuration */}
        <div className="p-6 rounded-xl border bg-card">
          <div className="flex items-center gap-2 mb-4">
            <FolderOpen className="w-4 h-4" />
            <h3 className="font-serif font-semibold tracking-tight">
              {t("cloneDirectory")}
            </h3>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            {t("cloneDirectoryDescription")}
          </p>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="clone-directory">{t("pathLabel")}</Label>

              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Input
                    id="clone-directory"
                    placeholder={t("placeholder")}
                    value={cloneDirectory}
                    onChange={(e) => setCloneDirectory(e.target.value)}
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {isValidating && (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                    {!isValidating && validation?.valid && (
                      <Check className="h-4 w-4 text-green-500" />
                    )}
                    {!isValidating && validation && !validation.valid && (
                      <X className="h-4 w-4 text-destructive" />
                    )}
                  </div>
                </div>
              </div>

              {expandedPath && (
                <p className="text-xs text-muted-foreground">
                  {t("expandsTo")}{" "}
                  <code className="px-1 py-0.5 bg-muted rounded">
                    {expandedPath}
                  </code>
                </p>
              )}

              {validation && !validation.valid && validation.error && (
                <p className="text-xs text-destructive">{validation.error}</p>
              )}

              {validation && validation.valid && !validation.exists && (
                <p className="text-xs text-yellow-600 dark:text-yellow-500">
                  {t("directoryWillBeCreated")}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">
                {t("commonPaths")}
              </Label>
              <div className="flex flex-wrap gap-2">
                {commonPaths.map((item) => (
                  <Button
                    key={item.path}
                    variant="outline"
                    size="sm"
                    onClick={() => setCloneDirectory(item.path)}
                    className="h-8"
                  >
                    <FolderOpen className="h-3 w-3 mr-1.5" />
                    {item.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="pt-4">
              <Button
                onClick={handleSave}
                disabled={!validation?.valid || isSaving}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("saving")}
                  </>
                ) : (
                  t("saveConfiguration")
                )}
              </Button>
            </div>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="test-defaults" className="space-y-6">
        <TestDefaultsForm />
      </TabsContent>
    </Tabs>
  );
}
