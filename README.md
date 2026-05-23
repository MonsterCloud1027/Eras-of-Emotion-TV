# Eras of Emotion (Taylor's Version)

Interactive visualization of Taylor Swift lyrics on a Plutchik-inspired radial emotion wheel. Scroll through albums, explore songs and sections, and drill into section-level emotion scores.

## Local development

```bash
npm install
npm run dev
```

## Deploy to GitHub Pages

1. Push this repository to GitHub (`Eras-of-Emotion-TV-`).
2. Open **Settings → Pages** and set **Build and deployment → Source** to **GitHub Actions**.
3. On each push to `main`, the workflow [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml) builds and publishes the site.

Live URL (if the repo name is unchanged):

**https://monstercloud1027.github.io/Eras-of-Emotion-TV-/**

Preview the Pages base path locally:

```bash
npm run build:pages
npm run preview:pages
```

If you rename the GitHub repository, update the `--base=/Eras-of-Emotion-TV-/` flag in:

- `package.json` (`build:pages`, `preview:pages`)
- `.github/workflows/deploy-pages.yml`

## Rebuild emotion wheel data (Python)

```bash
python build_emotion_wheel.py
```

Optional presets: `python build_emotion_wheel.py --preset all|test|llm`
