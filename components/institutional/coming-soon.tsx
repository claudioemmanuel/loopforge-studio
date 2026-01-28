"use client";

import { useState } from "react";
import { Clock, Bell, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ComingSoonProps {
  title: string;
  description: string;
  showEmailSignup?: boolean;
}

export function ComingSoon({
  title,
  description,
  showEmailSignup = false,
}: ComingSoonProps) {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      setSubmitted(true);
      setEmail("");
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-6 py-16 text-center">
      <div className="p-8 rounded-2xl border border-border bg-card/50 backdrop-blur-sm">
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-primary/10 flex items-center justify-center">
          <Clock className="w-8 h-8 text-primary" />
        </div>

        <h2 className="text-2xl font-semibold mb-3">{title}</h2>
        <p className="text-muted-foreground mb-8">{description}</p>

        {showEmailSignup && (
          <>
            {submitted ? (
              <div className="flex items-center justify-center gap-2 text-primary">
                <CheckCircle className="w-5 h-5" />
                <span>Thanks! We&apos;ll notify you when it&apos;s ready.</span>
              </div>
            ) : (
              <form
                onSubmit={handleSubmit}
                className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto"
              >
                <Input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="flex-1"
                />
                <Button type="submit" className="gap-2">
                  <Bell className="w-4 h-4" />
                  Notify Me
                </Button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
