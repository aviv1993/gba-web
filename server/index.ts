import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { savesRouter } from './saves.ts';
import { romRouter } from './rom.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// COOP/COEP headers required for SharedArrayBuffer (mGBA WASM threads)
app.use((_req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  next();
});

// APIs
app.use('/api/saves', savesRouter);
app.use('/api/roms', romRouter);

// Cache headers for static assets:
// - sw.js and index.html must never be cached (they change on every deploy)
// - Content-hashed assets (/assets/*) are immutable and can be cached forever
app.use((req, res, next) => {
  if (req.path === '/sw.js' || req.path === '/index.html' || req.path === '/') {
    res.setHeader('Cache-Control', 'no-store, no-cache');
  } else if (req.path.startsWith('/assets/')) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  }
  next();
});

// Serve static frontend build
const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));

// SPA fallback
app.get('/{*splat}', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`GBA Web server running on port ${PORT}`);
});
