"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { LoginForm } from "@/components/auth/login-form";

interface Particle {
  id: number;
  left: number;
  top: number;
  delay: number;
  duration: number;
  size: number;
}

export default function LoginPage() {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    // Generate particles on client to avoid hydration mismatch
    const generated = Array.from({ length: 30 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      top: Math.random() * 100,
      delay: Math.random() * 3,
      duration: 3 + Math.random() * 2,
      size: 2 + Math.random() * 3,
    }));
    setParticles(generated);
  }, []);

  return (
    <main className="min-h-screen relative overflow-hidden">
      {/* Base gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-primary/10" />

      {/* Large animated gradient orbs */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Primary orb - top left */}
        <div className="absolute -top-1/4 -left-1/4 w-[800px] h-[800px] rounded-full bg-primary/30 blur-3xl animate-gradient-shift" />

        {/* Accent orb - bottom right */}
        <div className="absolute -bottom-1/4 -right-1/4 w-[700px] h-[700px] rounded-full bg-accent/25 blur-3xl animate-gradient-shift animation-delay-300" />

        {/* Secondary orb - center floating */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-primary/20 blur-3xl animate-float" />

        {/* Additional accent orb for depth */}
        <div className="absolute top-1/4 right-1/4 w-[300px] h-[300px] rounded-full bg-accent/20 blur-2xl animate-gradient-shift animation-delay-500" />
      </div>

      {/* Floating particles effect */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {particles.map((p) => (
          <div
            key={p.id}
            className="absolute rounded-full bg-primary/50 animate-float"
            style={{
              left: `${p.left}%`,
              top: `${p.top}%`,
              width: `${p.size}px`,
              height: `${p.size}px`,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
            }}
          />
        ))}
      </div>

      {/* Subtle grid overlay for tech feel */}
      <div
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `linear-gradient(hsl(var(--primary)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary)) 1px, transparent 1px)`,
          backgroundSize: "50px 50px",
        }}
      />

      {/* Centered floating card */}
      <div className="relative z-10 min-h-screen flex items-center justify-center p-6">
        <Card className="w-full max-w-sm bg-card/80 dark:bg-card/60 backdrop-blur-xl border-border/50 shadow-2xl shadow-primary/20 opacity-0 animate-fade-up">
          <LoginForm variant="minimal" />
        </Card>
      </div>
    </main>
  );
}
