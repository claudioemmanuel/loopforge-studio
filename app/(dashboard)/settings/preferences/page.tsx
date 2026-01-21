"use client";

import { useState } from "react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Sun, Moon, Monitor } from "lucide-react";

export default function PreferencesPage() {
  const { theme, setTheme } = useTheme();
  const [notifications, setNotifications] = useState({
    taskCompleted: true,
    taskStuck: true,
    weeklySummary: false,
    browser: true,
  });

  return (
    <div className="space-y-6">
      {/* Appearance */}
      <div className="p-6 rounded-xl border bg-card">
        <h3 className="font-serif font-semibold tracking-tight mb-4">Appearance</h3>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Theme</label>
            <div className="flex gap-2">
              {([
                { value: "light", icon: Sun, label: "Light" },
                { value: "dark", icon: Moon, label: "Dark" },
                { value: "system", icon: Monitor, label: "System" },
              ] as const).map(({ value, icon: Icon, label }) => (
                <Button
                  key={value}
                  variant={theme === value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTheme(value)}
                >
                  <Icon className="w-4 h-4 mr-2" />
                  {label}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Notifications */}
      <div className="p-6 rounded-xl border bg-card">
        <h3 className="font-serif font-semibold tracking-tight mb-4">Notifications</h3>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Email notifications</p>
          {[
            { key: "taskCompleted", label: "Task completed" },
            { key: "taskStuck", label: "Task stuck (needs attention)" },
            { key: "weeklySummary", label: "Weekly summary" },
          ].map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between">
              <span className="text-sm">{label}</span>
              <button
                onClick={() => setNotifications(prev => ({
                  ...prev,
                  [key]: !prev[key as keyof typeof prev]
                }))}
                className={`w-10 h-6 rounded-full transition-colors ${
                  notifications[key as keyof typeof notifications]
                    ? "bg-primary"
                    : "bg-muted"
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white transition-transform ${
                    notifications[key as keyof typeof notifications]
                      ? "translate-x-5"
                      : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          ))}
          <div className="h-px bg-border" />
          <div className="flex items-center justify-between">
            <span className="text-sm">Browser notifications</span>
            <button
              onClick={() => setNotifications(prev => ({ ...prev, browser: !prev.browser }))}
              className={`w-10 h-6 rounded-full transition-colors ${
                notifications.browser ? "bg-primary" : "bg-muted"
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform ${
                  notifications.browser ? "translate-x-5" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Default Behaviors */}
      <div className="p-6 rounded-xl border bg-card">
        <h3 className="font-serif font-semibold tracking-tight mb-4">Default Behaviors</h3>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Default branch prefix</label>
            <select className="w-full px-3 py-2 rounded-md border bg-background text-sm">
              <option value="loopforge/">loopforge/</option>
              <option value="ai/">ai/</option>
              <option value="feature/">feature/</option>
            </select>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Require plan approval before execution</span>
            <button className="w-10 h-6 rounded-full bg-primary">
              <div className="w-4 h-4 rounded-full bg-white translate-x-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
