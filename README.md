<div align="center">

# Rimora

**A media discovery & tracking platform skeleton with social features.**

[![License](https://img.shields.io/badge/license-MIT-4ADE80)](LICENSE)
[![Stack](https://img.shields.io/badge/Next.js_14_%2B_Firebase-6B7280)](#tech-stack)
[![Tests](https://img.shields.io/badge/tests-Vitest_%2B_Playwright-6B7280)](#commands)

Built on Next.js 14 + Firebase: catalog, watch history, lists, real-time messaging,
watch parties and an admin panel — open-sourced after the original site shut down,
ready for anyone who wants to run their own platform.

**English** · [Türkçe](README.tr.md)

</div>

> **Ships without any video sources.** The player infrastructure is ready but empty —
> you define your own sources. See [Video sources](#video-sources).

---

## What's inside

**Content**
- TMDB-based movie / series / anime catalog, search and discovery pages
- Season–episode navigation, watch history, personal lists
- Multi-server video player skeleton

**Social**
- Real-time messaging — pinning, editing, replies, threads, mentions
- Watch-party rooms
- User profiles, activity feed, notifications

**Administration**
- Admin panel and moderation tools
- User ticket / feedback system
- Statistics pages

**Infrastructure**
- Firebase Auth, Firestore, Realtime Database, Storage, Cloud Messaging
- Optional iyzico subscription / payment flow
- Email via Resend, image management via Cloudinary
- i18n support, SEO components, PWA service worker
- Vitest (unit) + Playwright (E2E) tests, Firestore security-rule tests

## Tech stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 14.0.4 (App Router) |
| Language | TypeScript |
| UI | React 18, Tailwind CSS, Framer Motion |
| Backend | Firebase 12 (Auth / Firestore / RTDB / Storage / FCM) |
| Payments | iyzipay |
| Email | Resend |
| Media | Cloudinary |
| Tests | Vitest, Playwright |

**Requirement:** Node.js >= 20

## Setup

### 1. Get the project

```bash
git clone https://github.com/Aderimo/rimora-opensource.git
cd rimora-opensource
npm install
```

### 2. Create a Firebase project

1. Open a new project in the [Firebase Console](https://console.firebase.google.com)
2. **Authentication** → Sign-in method → enable *Email/Password*
3. Create a **Firestore Database**
4. Create a **Realtime Database** (messaging and watch parties)
5. Enable **Storage**
6. Project Settings → General → *Your apps* → add a Web app, note the SDK config values

### 3. Fill in environment variables

```bash
cp .env.example .env.local
```

Fill the fields in `.env.local`. At minimum:

- `NEXT_PUBLIC_FIREBASE_*` — Firebase web SDK config
- `TMDB_API_KEY` — free from [themoviedb.org](https://www.themoviedb.org/settings/api)

iyzico, Resend and Cloudinary are optional; leaving them empty disables those features.

### 4. Deploy Firebase rules

Replace `your-firebase-project-id` in `.firebaserc` with your own project id, then:

```bash
npx firebase deploy --only firestore:rules,storage,database
```

### 5. Run

```bash
npm run dev
```

http://localhost:3000

## Video sources

The player reads sources from the `NEXT_PUBLIC_VIDEO_SOURCES` environment variable.
With no sources defined, the player shows an empty state — the rest of the app works
normally.

The format is a JSON array. Template variables: `{tmdbId}`, `{season}`, `{episode}`.

```bash
NEXT_PUBLIC_VIDEO_SOURCES='[
  {
    "id": "my-cdn",
    "name": "Server 1",
    "quality": "1080p",
    "language": "TR",
    "priority": 1,
    "movie": "https://cdn.example.com/movie/{tmdbId}",
    "tv": "https://cdn.example.com/tv/{tmdbId}/{season}/{episode}"
  }
]'
```

Define multiple sources and they're listed by `priority`; users can switch servers.

⚠️ **Responsibility:** this project intentionally ships source-free. Only connect
sources you own the streaming rights to or that grant you those rights. Legal
responsibility for connected content is entirely yours.

## Commands

```bash
npm run dev            # development server
npm run build          # production build
npm run start          # production server
npm run lint           # ESLint
npm run test           # unit tests (Vitest)
npm run test:coverage  # coverage report
npm run test:e2e       # E2E tests (Playwright)
npm run test:security  # Firestore security-rule tests
```

## Deployment

Configured to run on Vercel (Netlify scripts are also included).

1. Connect the repo to Vercel
2. Add every variable from `.env.local` to Vercel → Settings → Environment Variables
3. Deploy

The `prebuild` step auto-generates the Firebase Cloud Messaging service worker from
`public/firebase-messaging-sw.template.js` — the generated file is not committed.

## Contributing

Open to issues and pull requests. For big changes, opening an issue to discuss first
is appreciated.

## License

[MIT](LICENSE)
