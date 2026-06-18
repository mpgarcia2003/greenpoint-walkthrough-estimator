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

## Verification

```bash
npm run lint
npm run build
npm audit --omit=dev
```
