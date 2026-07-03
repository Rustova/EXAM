# Exam Schedule — Countdown Timeline

A standalone version of your exam prep timeline app. Tasks are saved in
your browser's `localStorage`, so they persist on that device/browser
only (no account, no backend, no token needed).

## Run it locally first (recommended)

You'll need [Node.js](https://nodejs.org) installed (v18+).

```bash
npm install
npm run dev
```

Open the URL it prints (usually `http://localhost:5173`) and confirm
everything looks right before deploying.

## Deploy — pick one, all free

### Option A: Vercel (easiest)
1. Push this folder to a GitHub repo
2. Go to https://vercel.com → "Add New Project" → import the repo
3. Vercel auto-detects Vite. Click Deploy.
4. You get a live URL like `exam-timeline.vercel.app`

### Option B: Netlify
1. Run `npm run build` locally — creates a `dist/` folder
2. Go to https://app.netlify.com/drop
3. Drag the `dist/` folder onto the page
4. You get a live URL instantly, no GitHub needed

### Option C: GitHub Pages
1. Push this folder to a GitHub repo
2. In `vite.config.js`, add `base: '/your-repo-name/'`
3. Run `npm run build`
4. Push the `dist/` folder contents to a `gh-pages` branch
   (or use the `gh-pages` npm package to automate this)
5. Enable Pages in repo Settings → Pages → source: `gh-pages` branch

## Notes

- **Data is per-browser.** Since it uses `localStorage`, your tasks
  won't sync between your phone and laptop unless you're using the
  same browser profile with sync enabled (e.g. Chrome signed into the
  same Google account). If you want cross-device sync, that requires
  a real backend — ask if you want that built out later.
- **No login, no token, nothing to configure.** Just open the URL and
  it works.
- Editing `src/App.jsx` lets you tweak exam dates, colors, or layout —
  it's the same file structure as the Claude artifact version.
