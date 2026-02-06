import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  // Clean Architecture Boundary Rules
  // Prevent direct database imports in presentation and application layers
  {
    files: [
      "app/(dashboard)/**/*.{ts,tsx}",
      "app/(auth)/**/*.{ts,tsx}",
      "app/api/**/*.{ts,tsx}",
      "lib/contexts/*/application/**/*.{ts,tsx}",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/lib/db",
              message:
                "❌ BOUNDARY VIOLATION: Presentation and application layers cannot import @/lib/db directly.\n" +
                "✅ Fix: Use context facades (e.g., getTaskService()) or repository ports.\n" +
                "📖 See docs/architecture/BOUNDARY_RULES.md for details.",
            },
            {
              name: "@/lib/db/schema",
              message:
                "❌ BOUNDARY VIOLATION: Presentation layer cannot import database schema.\n" +
                "✅ Fix: Use context API facades that return DTOs.\n" +
                "📖 See docs/architecture/BOUNDARY_RULES.md for details.",
            },
            {
              name: "@/lib/db/schema/tables",
              message:
                "❌ BOUNDARY VIOLATION: Application layer cannot import database tables directly.\n" +
                "✅ Fix: Use repository ports defined in domain/ports.ts.\n" +
                "📖 See docs/architecture/BOUNDARY_RULES.md for details.",
            },
          ],
          patterns: [
            {
              group: ["@/lib/db/schema/*", "@/lib/db/*"],
              message:
                "❌ BOUNDARY VIOLATION: Direct database access not allowed in this layer.\n" +
                "✅ Fix: Use infrastructure adapters in lib/contexts/*/infrastructure/.\n" +
                "📖 See docs/architecture/BOUNDARY_RULES.md for details.",
            },
          ],
        },
      ],
    },
  },
  // Permanent exceptions (documented in docs/architecture/BOUNDARY_RULES.md)
  {
    files: [
      "app/api/system/health/**/*.{ts,tsx}",
      "app/api/workers/monitoring/**/*.{ts,tsx}",
    ],
    rules: {
      "no-restricted-imports": "off",
    },
  },
];

export default eslintConfig;
