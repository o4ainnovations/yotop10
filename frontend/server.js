// Custom Next.js server with proper dynamic route handling
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    const { pathname, query } = parsedUrl;

    // Add trailing slash handling for all routes
    let newPathname = pathname;
    if (!pathname.endsWith('/') && !pathname.includes('.') && pathname !== '/') {
      newPathname = pathname + '/';
    }

    // Handle specific routes
    if (newPathname === '/categories/' || pathname === '/categories') {
      return app.render(req, res, '/categories', query);
    }
    if (newPathname === '/post/' || pathname.startsWith('/post/')) {
      // Extract the post ID from the path
      const postMatch = pathname.match(/^\/post\/([^\/]+)/);
      if (postMatch) {
        const id = postMatch[1];
        if (pathname.includes('/history')) {
          return app.render(req, res, '/post/[id]/history', { ...query, id });
        }
        return app.render(req, res, '/post/[id]', { ...query, id });
      }
    }
    if (pathname.startsWith('/c/')) {
      // Extract category slug
      const catMatch = pathname.match(/^\/c\/([^\/]+)/);
      if (catMatch) {
        return app.render(req, res, '/c/[slug]', { ...query, slug: catMatch[1] });
      }
    }

    // Default handler for all other routes
    handle(req, res, parsedUrl);
  }).listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});