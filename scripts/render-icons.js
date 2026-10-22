// Run from the repository root with the installed Playwright CLI:
// playwright-cli -s=scrapeyy-icons open about:blank
// playwright-cli -s=scrapeyy-icons run-code --filename=scripts/render-icons.js
// playwright-cli -s=scrapeyy-icons close
// The inline vector below is the exact public/icon/source.svg drawing.
async (page) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="28" fill="#14243d"/>
  <path d="M32 26h49l16 16v59H32z" fill="#eef6ff"/>
  <path d="M81 26v16h16" fill="#aac7e8"/>
  <path d="M44 54h39M44 67h39M44 80h24" stroke="#4879b6" stroke-width="6" stroke-linecap="round"/>
  <path d="m76 75 26 10-12 7-6 13z" fill="#ffb154" stroke="#14243d" stroke-width="3" stroke-linejoin="round"/>
</svg>`;
  await page.setContent(`<style>html,body{margin:0;padding:0;background:transparent}svg{width:100vw;height:100vh;display:block}</style>${svg}`);
  for (const size of [16, 32, 48, 96, 128]) {
    await page.setViewportSize({ width: size, height: size });
    await page.screenshot({ path: `public/icon/${size}.png`, omitBackground: true });
  }
}
