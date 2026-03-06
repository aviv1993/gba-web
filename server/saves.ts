import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAVES_DIR = path.join(__dirname, '..', 'saves');

// Ensure saves directory exists
fs.mkdirSync(SAVES_DIR, { recursive: true });

export const savesRouter = Router();

// List all saves
savesRouter.get('/', (_req, res) => {
  const saves: { game: string; slot: string; updatedAt: string }[] = [];

  if (!fs.existsSync(SAVES_DIR)) {
    res.json(saves);
    return;
  }

  for (const game of fs.readdirSync(SAVES_DIR)) {
    const gameDir = path.join(SAVES_DIR, game);
    if (!fs.statSync(gameDir).isDirectory()) continue;

    for (const file of fs.readdirSync(gameDir)) {
      const slot = file.replace(/\.bin$/, '');
      const stat = fs.statSync(path.join(gameDir, file));
      saves.push({
        game,
        slot,
        updatedAt: stat.mtime.toISOString(),
      });
    }
  }

  res.json(saves);
});

// Download a save
savesRouter.get('/:game/:slot', (req, res) => {
  const { game, slot } = req.params;
  const filePath = path.join(SAVES_DIR, game, `${slot}.bin`);

  if (!fs.existsSync(filePath)) {
    res.status(404).send('Not found');
    return;
  }

  res.setHeader('Content-Type', 'application/octet-stream');
  res.sendFile(filePath);
});

// Upload a save (PUT for normal requests, POST for sendBeacon)
function handleUpload(req: import('express').Request, res: import('express').Response) {
  const { game, slot } = req.params;
  const gameDir = path.join(SAVES_DIR, game);
  fs.mkdirSync(gameDir, { recursive: true });

  const filePath = path.join(gameDir, `${slot}.bin`);
  const chunks: Buffer[] = [];

  req.on('data', (chunk: Buffer) => chunks.push(chunk));
  req.on('end', () => {
    fs.writeFileSync(filePath, Buffer.concat(chunks));
    res.json({ ok: true });
  });
}

savesRouter.put('/:game/:slot', handleUpload);
savesRouter.post('/:game/:slot', handleUpload);
