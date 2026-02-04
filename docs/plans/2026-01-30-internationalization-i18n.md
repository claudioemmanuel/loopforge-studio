# Internationalization (i18n) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add internationalization support to Loopforge Studio with EN/PT-BR languages, language switcher in navigation, and user preference persistence in database.

**Architecture:** Use next-intl for Next.js 15 App Router integration with Server Components support. Store language preference in users table, apply globally via middleware, and provide translations for all user-facing text.

**Tech Stack:** next-intl v3.x, PostgreSQL (language preference), Drizzle ORM, React Server Components

---

## Task 1: Install next-intl and Configure Project

**Files:**

- Modify: `package.json`
- Create: `i18n.ts`
- Create: `middleware.ts` (root level)
- Create: `navigation.ts`

**Step 1: Install next-intl**

```bash
npm install next-intl
```

Expected: Package installed successfully

**Step 2: Create i18n configuration**

Create: `i18n.ts`

```typescript
import { getRequestConfig } from "next-intl/server";
import { headers } from "next/headers";

export const locales = ["en", "pt-BR"] as const;
export type Locale = (typeof locales)[number];

export default getRequestConfig(async () => {
  const headersList = await headers();
  const locale = headersList.get("x-locale") || "en";

  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
  };
});
```

**Step 3: Create middleware for locale detection**

Create: `middleware.ts`

```typescript
import createMiddleware from "next-intl/middleware";
import { locales } from "./i18n";

export default createMiddleware({
  locales,
  defaultLocale: "en",
  localeDetection: false, // We'll handle detection via database
});

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
```

**Step 4: Create navigation helpers**

Create: `navigation.ts`

```typescript
import { createSharedPathnamesNavigation } from "next-intl/navigation";
import { locales } from "./i18n";

export const { Link, redirect, usePathname, useRouter } =
  createSharedPathnamesNavigation({ locales });
```

**Step 5: Commit**

```bash
git add package.json i18n.ts middleware.ts navigation.ts
git commit -m "feat(i18n): install next-intl and configure project structure"
```

---

## Task 2: Add Language Preference to Database Schema

**Files:**

- Modify: `lib/db/schema/tables.ts:30-60` (users table)
- Create migration file (generated)

**Step 1: Add locale column to users table**

Modify: `lib/db/schema/tables.ts`

Find the users table definition and add:

```typescript
export const users = pgTable("users", {
  // ... existing fields ...
  locale: text("locale").default("en"), // Add this line
});
```

**Step 2: Generate migration**

```bash
npm run db:generate
```

Expected: Migration file created in `drizzle/` directory with name like `0033_add_locale_to_users.sql`

**Step 3: Review migration**

Open the generated migration file and verify it contains:

```sql
ALTER TABLE "users" ADD COLUMN "locale" text DEFAULT 'en';
```

**Step 4: Run migration**

```bash
npm run db:migrate
```

Expected: Migration applied successfully

**Step 5: Commit**

```bash
git add lib/db/schema/tables.ts drizzle/*.sql
git commit -m "feat(i18n): add locale preference column to users table"
```

---

## Task 3: Create Translation Files

**Files:**

- Create: `messages/en.json`
- Create: `messages/pt-BR.json`

**Step 1: Create English messages file**

Create: `messages/en.json`

```json
{
  "common": {
    "loading": "Loading...",
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete",
    "edit": "Edit",
    "close": "Close",
    "confirm": "Confirm",
    "back": "Back"
  },
  "navigation": {
    "dashboard": "Dashboard",
    "repositories": "Repositories",
    "execution": "Execution",
    "settings": "Settings",
    "signOut": "Sign Out"
  },
  "tasks": {
    "createTask": "Create Task",
    "taskTitle": "Task Title",
    "description": "Description",
    "status": "Status",
    "autonomousMode": "Autonomous Mode",
    "statuses": {
      "todo": "To Do",
      "brainstorming": "Brainstorming",
      "planning": "Planning",
      "ready": "Ready",
      "executing": "Executing",
      "done": "Done",
      "stuck": "Stuck"
    }
  },
  "settings": {
    "account": "Account",
    "preferences": "Preferences",
    "language": "Language",
    "selectLanguage": "Select Language"
  }
}
```

**Step 2: Create Portuguese (Brazil) messages file**

Create: `messages/pt-BR.json`

```json
{
  "common": {
    "loading": "Carregando...",
    "save": "Salvar",
    "cancel": "Cancelar",
    "delete": "Excluir",
    "edit": "Editar",
    "close": "Fechar",
    "confirm": "Confirmar",
    "back": "Voltar"
  },
  "navigation": {
    "dashboard": "Painel",
    "repositories": "Repositórios",
    "execution": "Execução",
    "settings": "Configurações",
    "signOut": "Sair"
  },
  "tasks": {
    "createTask": "Criar Tarefa",
    "taskTitle": "Título da Tarefa",
    "description": "Descrição",
    "status": "Status",
    "autonomousMode": "Modo Autônomo",
    "statuses": {
      "todo": "A Fazer",
      "brainstorming": "Brainstorming",
      "planning": "Planejamento",
      "ready": "Pronto",
      "executing": "Executando",
      "done": "Concluído",
      "stuck": "Travado"
    }
  },
  "settings": {
    "account": "Conta",
    "preferences": "Preferências",
    "language": "Idioma",
    "selectLanguage": "Selecionar Idioma"
  }
}
```

**Step 3: Commit**

```bash
git add messages/
git commit -m "feat(i18n): add EN and PT-BR translation files"
```

---

## Task 4: Create Language Switcher Component

**Files:**

- Create: `components/language-switcher.tsx`

**Step 1: Create language switcher component**

Create: `components/language-switcher.tsx`

```typescript
"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Globe, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

const languages = [
  { code: "en", label: "English", flag: "🇺🇸" },
  { code: "pt-BR", label: "Português (BR)", flag: "🇧🇷" },
] as const;

export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations("settings");
  const [isPending, startTransition] = useTransition();

  const handleLanguageChange = async (newLocale: string) => {
    startTransition(async () => {
      try {
        // Update user preference in database
        await fetch("/api/user/locale", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ locale: newLocale }),
        });

        // Refresh to apply new locale
        router.refresh();
      } catch (error) {
        console.error("Failed to update language:", error);
      }
    });
  };

  const currentLanguage = languages.find((lang) => lang.code === locale);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-2"
          disabled={isPending}
        >
          <Globe className="h-4 w-4" />
          <span className="hidden sm:inline">
            {currentLanguage?.flag} {currentLanguage?.label}
          </span>
          <span className="sm:hidden">{currentLanguage?.flag}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {languages.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => handleLanguageChange(lang.code)}
            className="gap-2 cursor-pointer"
          >
            <span>{lang.flag}</span>
            <span>{lang.label}</span>
            {locale === lang.code && <Check className="h-4 w-4 ml-auto" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

**Step 2: Commit**

```bash
git add components/language-switcher.tsx
git commit -m "feat(i18n): create language switcher dropdown component"
```

---

## Task 5: Create API Route for Updating User Locale

**Files:**

- Create: `app/api/user/locale/route.ts`

**Step 1: Create locale update API route**

Create: `app/api/user/locale/route.ts`

```typescript
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, users } from "@/lib/db";
import { eq } from "drizzle-orm";
import { handleError, Errors } from "@/lib/errors";
import { z } from "zod";

const localeSchema = z.object({
  locale: z.enum(["en", "pt-BR"]),
});

export async function PATCH(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return handleError(Errors.unauthorized());
  }

  try {
    const body = await request.json();
    const { locale } = localeSchema.parse(body);

    await db.update(users).set({ locale }).where(eq(users.id, session.user.id));

    return NextResponse.json({ success: true, locale });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid locale" }, { status: 400 });
    }
    return handleError(error);
  }
}
```

**Step 2: Commit**

```bash
git add app/api/user/locale/route.ts
git commit -m "feat(i18n): add API route for updating user locale preference"
```

---

## Task 6: Update Root Layout with Locale Provider

**Files:**

- Modify: `app/layout.tsx`

**Step 1: Wrap app with NextIntlClientProvider**

Modify: `app/layout.tsx`

Find the RootLayout component and update:

```typescript
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getLocale } from 'next-intl/server';

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider messages={messages} locale={locale}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
```

**Step 2: Commit**

```bash
git add app/layout.tsx
git commit -m "feat(i18n): wrap app with NextIntlClientProvider"
```

---

## Task 7: Update Navigation to Include Language Switcher

**Files:**

- Modify: `components/landing/navigation.tsx` (landing page)
- Modify: `components/sidebar/desktop-sidebar.tsx` (dashboard)

**Step 1: Add language switcher to landing navigation**

Modify: `components/landing/navigation.tsx`

Import and add the LanguageSwitcher component next to the GitHub sign-in button:

```typescript
import { LanguageSwitcher } from "@/components/language-switcher";

// In the navigation component:
<div className="flex items-center gap-4">
  <LanguageSwitcher />
  <Button variant="ghost" size="sm">
    <Github className="w-4 h-4 mr-2" />
    Sign in with GitHub
  </Button>
</div>
```

**Step 2: Add language switcher to dashboard sidebar**

Modify: `components/sidebar/desktop-sidebar.tsx`

Add LanguageSwitcher in the user menu section:

```typescript
import { LanguageSwitcher } from "@/components/language-switcher";

// In the user dropdown or settings section:
<LanguageSwitcher />
```

**Step 3: Commit**

```bash
git add components/landing/navigation.tsx components/sidebar/desktop-sidebar.tsx
git commit -m "feat(i18n): add language switcher to navigation and sidebar"
```

---

## Task 8: Create Locale Detection Middleware Enhancement

**Files:**

- Modify: `middleware.ts`
- Create: `lib/i18n/locale-detector.ts`

**Step 1: Create locale detector utility**

Create: `lib/i18n/locale-detector.ts`

```typescript
import { auth } from "@/lib/auth";
import { db, users } from "@/lib/db";
import { eq } from "drizzle-orm";
import type { Locale } from "@/i18n";

export async function detectUserLocale(): Promise<Locale> {
  try {
    const session = await auth();

    if (session?.user?.id) {
      const user = await db.query.users.findFirst({
        where: eq(users.id, session.user.id),
        columns: { locale: true },
      });

      if (user?.locale && (user.locale === "en" || user.locale === "pt-BR")) {
        return user.locale as Locale;
      }
    }
  } catch (error) {
    console.error("Error detecting user locale:", error);
  }

  return "en"; // Default fallback
}
```

**Step 2: Update middleware to use database locale**

Modify: `middleware.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { locales } from "./i18n";
import { detectUserLocale } from "./lib/i18n/locale-detector";

const intlMiddleware = createIntlMiddleware({
  locales,
  defaultLocale: "en",
  localeDetection: false,
});

export async function middleware(request: NextRequest) {
  const locale = await detectUserLocale();

  // Add locale to request headers for i18n config
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-locale", locale);

  const response = intlMiddleware(request);

  // Preserve the locale header in response
  response.headers.set("x-locale", locale);

  return response;
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
```

**Step 3: Commit**

```bash
git add lib/i18n/locale-detector.ts middleware.ts
git commit -m "feat(i18n): enhance middleware with database locale detection"
```

---

## Task 9: Translate Core UI Components

**Files:**

- Modify: `components/modals/new-task-modal.tsx`
- Modify: `components/sidebar/desktop-sidebar.tsx`
- Modify: `components/kanban/kanban-board.tsx`

**Step 1: Translate new task modal**

Modify: `components/modals/new-task-modal.tsx`

Add at top:

```typescript
import { useTranslations } from "next-intl";
```

In component:

```typescript
const t = useTranslations("tasks");

// Replace hardcoded strings:
// "Create Task" → {t('createTask')}
// "Task Title" → {t('taskTitle')}
// "Description" → {t('description')}
```

**Step 2: Translate sidebar navigation**

Modify: `components/sidebar/desktop-sidebar.tsx`

```typescript
import { useTranslations } from "next-intl";

const t = useTranslations("navigation");

// Replace:
// "Dashboard" → {t('dashboard')}
// "Repositories" → {t('repositories')}
// "Execution" → {t('execution')}
// "Settings" → {t('settings')}
```

**Step 3: Translate Kanban board columns**

Modify: `components/kanban/kanban-board.tsx`

```typescript
import { useTranslations } from "next-intl";

const t = useTranslations("tasks.statuses");

// Replace status labels:
// "To Do" → {t('todo')}
// "Brainstorming" → {t('brainstorming')}
// etc.
```

**Step 4: Commit**

```bash
git add components/modals/new-task-modal.tsx components/sidebar/desktop-sidebar.tsx components/kanban/kanban-board.tsx
git commit -m "feat(i18n): translate core UI components"
```

---

## Task 10: Add Comprehensive Translations

**Files:**

- Modify: `messages/en.json`
- Modify: `messages/pt-BR.json`

**Step 1: Expand English translations**

Modify: `messages/en.json` - Add sections for:

- Landing page (hero, features, pricing)
- Settings pages (account, preferences, workflow, danger zone)
- Error messages
- Success messages
- Activity feed
- Execution logs

**Step 2: Expand Portuguese translations**

Modify: `messages/pt-BR.json` - Mirror all additions from English with proper PT-BR translations

**Step 3: Commit**

```bash
git add messages/
git commit -m "feat(i18n): add comprehensive translations for all pages"
```

---

## Task 11: Test and Verify

**Files:**

- None (manual testing)

**Step 1: Test language switching**

1. Start dev server: `npm run dev`
2. Navigate to dashboard
3. Click language switcher
4. Select PT-BR
5. Verify all text changes to Portuguese
6. Refresh page and verify language persists
7. Switch back to EN
8. Verify language updates correctly

Expected: Seamless language switching with preference persistence

**Step 2: Test new user default**

1. Sign out
2. Create new test account
3. Verify default language is English
4. Switch to PT-BR
5. Sign out and back in
6. Verify PT-BR is remembered

Expected: Language preference persists across sessions

**Step 3: Verify database**

```bash
# Connect to database
psql $DATABASE_URL

# Check user locales
SELECT id, username, locale FROM users LIMIT 5;
```

Expected: locale column populated with 'en' or 'pt-BR'

**Step 4: Final commit**

```bash
git add .
git commit -m "feat(i18n): complete internationalization implementation with EN/PT-BR support"
```

---

## Execution Notes

- **IMPORTANT**: After Task 2, restart dev server to pick up schema changes
- **IMPORTANT**: After Task 6, test that app still loads correctly before proceeding
- Test language switching after each UI component translation (Tasks 9-10)
- Use browser DevTools to verify locale headers and API calls
- Check console for any i18n-related errors

## Success Criteria

✅ Language switcher appears in navigation
✅ Clicking language changes all UI text
✅ User preference stored in database
✅ Language persists across page refreshes and sessions
✅ New users default to English
✅ All major pages translated (dashboard, settings, tasks)
✅ No console errors related to missing translations

---

**Total estimated time**: 3-4 hours for skilled developer
**Critical path**: Tasks 1-6 must be done in order; Tasks 9-10 can be parallelized
