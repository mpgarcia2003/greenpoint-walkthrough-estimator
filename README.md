# GreenPoint Walkthrough Estimator

Mobile-first janitorial walkthrough estimating app built with Next.js,
TypeScript, Tailwind CSS, ShadCN-style UI components, and Supabase.

## Local Development

Create a local environment file:

```bash
cp .env.example .env.local
```

Add your Supabase project values:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-or-publishable-key
```

Run the app:

```bash
npm install
npm run dev
```

Open http://127.0.0.1:3001 when running through the included dev command in
this workspace.

## Supabase Auth, Organizations, And RLS

The app uses Supabase Auth for sign in, a tenant model based on organizations,
and Row Level Security for walkthrough data and saved PDF files.

1. In Supabase SQL Editor, run:

```bash
supabase/schema.sql
```

2. In Supabase Authentication, enable the Email provider. If email confirmation
   is enabled, new users must confirm their email before they can sign in.

3. In Supabase Authentication URL Configuration, add your local and deployed app
   URLs, such as:

```text
http://127.0.0.1:3001
https://your-vercel-domain.vercel.app
```

4. Add these variables locally and in Vercel:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-or-publishable-key
```

No service role key is required for normal walkthrough saving. The browser sends
the signed-in user's Supabase session to the Next.js API routes, and Supabase
RLS decides which organization rows and private storage files that user can
access.

When cloud storage is configured, the Saved Walkthroughs panel stores:

- editable walkthrough data in `public.walkthroughs`
- generated PDFs in the private `walkthrough-files` storage bucket
- generated proposal PDFs in the same private storage bucket, linked by
  `proposal_pdf_path` and `proposal_generated_at`

Walkthroughs created before the organization schema may have a blank
`organization_id`; RLS will hide those old rows until they are assigned to an
organization.

## Vercel

After pushing to GitHub:

1. Import the GitHub repository in Vercel.
2. Use the default Next.js settings.
3. Add the Supabase environment variables in Project Settings > Environment
   Variables for Production and Preview.
4. Deploy.

## GitHub

This project should be pushed as its own repository from this folder:

```bash
git init
git add .
git commit -m "Initial GreenPoint estimator"
git branch -M main
git remote add origin https://github.com/OWNER/greenpoint-walkthrough-estimator.git
git push -u origin main
```

## Verification

```bash
npm run lint
npm run build
npm audit --omit=dev
```
