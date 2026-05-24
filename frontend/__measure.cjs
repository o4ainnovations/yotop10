const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto('http://localhost:3100/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1000);

  // Measure PostCarouselCard in desktop container
  const cards = await page.evaluate(() => {
    const all = document.querySelectorAll('a[href^="/"]');
    const results = [];
    for (const el of all) {
      const r = el.getBoundingClientRect();
      const s = window.getComputedStyle(el);
      // Filter to only cards (they have border radius, flex column)
      if (r.width > 200 && r.height > 200 && s.display === 'flex') {
        results.push({
          tag: el.tagName,
          href: el.getAttribute('href'),
          w: Math.round(r.width),
          h: Math.round(r.height),
          ratio: (r.width / r.height).toFixed(2),
        });
      }
    }
    return results.slice(0, 5);
  });

  console.log('Card dimensions on desktop:');
  cards.forEach(c => console.log(`  ${c.href}: ${c.w}x${c.h} (ratio ${c.ratio})`));

  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
