# GreenPoint Walkthrough Estimator

Mobile-first janitorial walkthrough estimating app built with Next.js,
TypeScript, Tailwind CSS, and ShadCN-style UI components.

## Local Development

Create a local passcode file:

```bash
cp .env.example .env.local
```

Set a 6 digit passcode:

```bash
GREENPOINT_PASSCODE=123456
```

Run the app:

```bash
npm install
npm run dev
```

Open http://127.0.0.1:3001 when running through the included dev command in
this workspace. The local default passcode is `123456` until you change
`.env.local`.

## Passcode Protection

The app checks `GREENPOINT_PASSCODE` on the server and stores access in an
HTTP-only cookie. Do not commit `.env.local`; it is intentionally ignored.

For production, set `GREENPOINT_PASSCODE` in Vercel project environment
variables. Use a private 6 digit code.

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

## Vercel

After pushing to GitHub:

1. Import the GitHub repository in Vercel.
2. Use the default Next.js settings.
3. Add `GREENPOINT_PASSCODE` in Project Settings > Environment Variables.
4. Deploy.

You can also deploy from this folder with the Vercel CLI:

```bash
vercel
vercel env add GREENPOINT_PASSCODE production
vercel --prod
```

## Supabase Cloud Walkthroughs

The app supports cloud saved walkthroughs through server-side API routes. The
browser never writes directly to the Supabase tables.

1. In Supabase SQL Editor, run:

```bash
supabase/schema.sql
```

2. Add these environment variables locally and in Vercel:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-or-publishable-key
SUPABASE_SERVICE_ROLE_KEY=your-server-only-service-role-key
```

`SUPABASE_SERVICE_ROLE_KEY` must only be used server-side. Do not commit it and
do not expose it in browser code.

3. In Supabase Data API settings, make sure the `walkthroughs` table is exposed
to the Data API if your project does not expose new tables automatically.

When cloud is configured, the Saved Walkthroughs panel stores:

- editable walkthrough data in `public.walkthroughs`
- generated PDFs in the private `walkthrough-files` storage bucket

If cloud is not configured, the app falls back to local browser history.

## Verification

```bash
npm run lint
npm run build
npm audit --omit=dev
```
