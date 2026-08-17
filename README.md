# Lyzr Internal Dashboard — Next.js

A 1:1 port of the TanStack Start dashboard to **Next.js 15 (App Router) + TypeScript**. Same Supabase backend, same UI, same routes — just running on Next.js.

## Stack

- **Next.js 15** (App Router, React 19)
- **TypeScript** (strict)
- **Tailwind CSS v4**
- **shadcn/ui** (Radix primitives)
- **Supabase JS** for auth + data
- **TanStack Query**, **react-hook-form**, **zod**, **date-fns**, **sonner**, **lucide-react**

## Getting started

```bash
# 1. Install dependencies
npm install
# or: pnpm install / bun install / yarn

# 2. Configure env
cp .env.local.example .env.local
# Fill in NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

# 3. Run dev server
npm run dev
```

Open http://localhost:3000.

## Routes

All app routes live under the `(app)` route group, which applies the auth guard + sidebar layout.

| Path                   | Page                              |
| ---------------------- | --------------------------------- |
| `/`                    | Summary (RAG status + metrics)    |
| `/mqls`                | MQLs (HubSpot placeholder)        |
| `/leads`               | Leads list + manual entry         |
| `/architect`           | Architect product                 |
| `/studio-signups`      | Agent Studio signups              |
| `/prebuilt-agents`     | Pre-Built Agents                  |
| `/lyzr-gpt`            | Lyzr GPT                          |
| `/email`               | Email Marketing                   |
| `/events`              | Events                            |
| `/seo`                 | SEO                               |
| `/ads`                 | Ads Performance                   |
| `/pages`               | Organic & SEO Pages               |
| `/partners-emerging`   | Emerging Partners                 |
| `/partners-aws`        | AWS & Hyperscalers                |
| `/partners-gsi`        | GSI & SI                          |
| `/git-agent`           | Git Agent                         |
| `/weekly-update`       | Weekly update entry form          |
| `/admin`               | Goals & allowed signup domains    |
| `/assistant`           | AI Assistant chat                 |
| `/login`               | Sign in / Create account          |

## Project structure

```
src/
├── app/
│   ├── (app)/                 # Auth-guarded layout group
│   │   ├── layout.tsx         # Sidebar + auth check
│   │   ├── page.tsx           # /  (Summary)
│   │   └── <section>/page.tsx
│   ├── login/page.tsx
│   ├── layout.tsx             # Root layout + AuthProvider + Toaster
│   └── globals.css            # Tailwind v4 + design tokens
├── components/
│   ├── AppSidebar.tsx
│   ├── PageHeader.tsx
│   ├── SectionShell.tsx
│   └── ui/                    # shadcn components
├── hooks/use-mobile.tsx
├── integrations/supabase/
│   ├── client.ts              # Public Supabase client (browser)
│   └── types.ts               # DB types
└── lib/
    ├── auth-context.tsx       # AuthProvider + useAuth()
    └── utils.ts
```

## Notes

- The Supabase database schema, RLS policies, and seeded metrics catalog are unchanged from the original project — point this app at the same Supabase project and everything works.
- The auth guard runs client-side inside the `(app)` layout because Supabase auth lives in `localStorage`.
- All shadcn components are marked `"use client"` for App Router compatibility.
