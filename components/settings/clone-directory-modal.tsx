"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, X, Loader2, FolderOpen, ExternalLink } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import Link from "next/link";

interface CloneDirectoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfigured: () => void;
}

export function CloneDirectoryModal({
  open,
  onOpenChange,
  onConfigured,
}: CloneDirectoryModalProps) {
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
        title: "Invalid directory",
        description: validation?.error || "Please enter a valid directory path",
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
        title: "Configuration saved",
        description: "Clone directory configured successfully",
      });
      onConfigured();
    } catch (error) {
      toast({
        title: "Failed to save",
        description:
          error instanceof Error ? error.message : "Unknown error occurred",
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
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Configure Clone Directory</DialogTitle>
          <DialogDescription>
            Choose where repositories should be cloned on your local machine.
            You can change this later in Settings.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="modal-clone-directory">Clone Directory</Label>
            <div className="relative">
              <Input
                id="modal-clone-directory"
                placeholder="~/Documents/GitHub/loopforge-repos"
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

            {expandedPath && (
              <p className="text-xs text-muted-foreground">
                Expands to:{" "}
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
                Directory will be created on first clone
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">
              Quick Select
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
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Link
            href="/settings/workflow"
            className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            Configure in Settings
            <ExternalLink className="h-3 w-3" />
          </Link>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!validation?.valid || isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save & Continue"
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
