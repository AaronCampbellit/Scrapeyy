# Scrapeyy scraper icon

The active brand from 0.1.21 is a blue-handled scraper with a pale cyan blade on a midnight navy badge. Aaron requested a new icon used everywhere, then specified that it should look like a scraper.

Canonical master: [scrapeyy-icon.png](scrapeyy-icon.png), generated on 2026-10-22 with the built-in OpenAI image generation tool in **generation mode**, with transparency requested. No reference images or external artwork were supplied. The earlier abstract S proposal was not adopted.

All runtime images in [`public/icon/`](../../public/icon/) are direct resizes of this master. The extension manifest and browser action share those same five files; popup and standalone preview headers use the 96px image, and extension page favicons use the 32px image. The README uses the 128px image. The previous paper SVG is archived in [archive/paper-icon.svg](archive/paper-icon.svg) and is not shipped as an active icon.

Regenerate with Node and Playwright available:

```sh
node scripts/render-icons.js
```

If Playwright is supplied by an external tool runtime, set `PLAYWRIGHT_MODULE` to its module URL first. The renderer uses headless Chromium canvas with high-quality smoothing, preserves transparency, and closes its browser when done. No image-generation step is needed to reproduce the runtime sizes.

## Generation prompt

> Design ONE finished app icon for Scrapeyy, a web scraping and screenshot capture browser extension. The icon MUST clearly depict a physical paint scraper / scraping tool, not an abstract letter or monogram. A wide flat trapezoid scraper blade with a crisp cutting edge, a short neck and a chunky comfortable handle, angled diagonally from lower left to upper right. The blade is the dominant recognizable shape, in pale ice blue / cyan with one subtle cobalt edge; the substantial handle is electric cobalt blue with a bright cyan accent. Make the scraper silhouette very obvious and elegant, like a premium custom tool pictogram. Deep midnight navy rounded-square backplate with transparent canvas outside its corners. Centered balanced composition, tool fills about 75 percent of badge with comfortable even clearance. Bold simple geometric shapes, very few details, clean vector-like rendering, refined restrained gradients, excellent contrast and legibility at 16 and 32 pixels. No text, no letters, no paper or document sheet, no paintbrush or bristles, no broom, no cursor, no sparkles, no tiny data marks, no ornamental texture, no external shadow. Single icon straight on, no variants, no presentation sheet or mockup.
