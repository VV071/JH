# Before I Knew Your Name

A standalone React + Vite book website with the supplied photograph as its cover, 200 story pages, and a responsive reader. No account, API key, database, or hosting-specific runtime is needed.

## Deploy to Vercel

1. Push this project to your own GitHub repository.
2. Import that repository into Vercel and use the project root directory.
3. Deploy. The included `vercel.json` sets the Vite preset, `npm ci` install command, `npm run build` build command, and `dist` output directory.

No environment variables are required. Use Node.js 22.13 or later. Vercel controls the resulting domain and deployment access settings.

Official guide: https://vercel.com/docs/frameworks/frontend/vite

## Run locally

```sh
npm ci
npm run dev
```

For the production build:

```sh
npm run typecheck
npm run build
npm run preview
```

## Edit the book

- Story: `content/part1.txt` through `content/part4.txt`.
- Cover photograph: `public/cover.jpg`.
- Reading experience: `app/page.tsx`.
- Styling: `app/globals.css`.

Each story page starts with `@` and its page number. Each chapter starts with `#`, its number, `|`, and its title. The build regenerates `app/story.json` and checks all 200 unique pages, the 20 chapter boundaries, and the boy’s first name reveal on page 101.

The distributable website is generated into `dist`. Local caches, dependencies, and build output do not belong in your source repository.
