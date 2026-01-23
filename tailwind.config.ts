import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Greenhouse-inspired color palette
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        // Custom colors for Kanban
        kanban: {
          todo: "hsl(var(--kanban-todo))",
          brainstorming: "hsl(var(--kanban-brainstorming))",
          planning: "hsl(var(--kanban-planning))",
          ready: "hsl(var(--kanban-ready))",
          executing: "hsl(var(--kanban-executing))",
          done: "hsl(var(--kanban-done))",
          stuck: "hsl(var(--kanban-stuck))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "'Inter'", "system-ui", "sans-serif"],
        serif: ["var(--font-serif)", "'Playfair Display'", "Georgia", "serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      animation: {
        "gradient-rotate": "gradient-rotate 3s linear infinite",
        "slide-to-lane": "slide-to-lane 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
      },
      keyframes: {
        "slide-to-lane": {
          "0%": { opacity: "0.8", transform: "translateX(-20px) scale(0.98)" },
          "50%": { transform: "translateX(5px) scale(1.01)" },
          "100%": { opacity: "1", transform: "translateX(0) scale(1)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
