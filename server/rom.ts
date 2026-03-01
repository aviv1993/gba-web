import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAVES_DIR = path.join(__dirname, '..', 'saves');
const ROMS_DIR = path.join(SAVES_DIR, '_roms');

fs.mkdirSync(ROMS_DIR, { recursive: true });

export const romRouter = Router();

// List available ROMs
romRouter.get('/', (_req, res) => {
  if (!fs.existsSync(ROMS_DIR)) {
    res.json([]);
    return;
  }

  const roms = fs.readdirSync(ROMS_DIR)
    .filter(f => f.match(/\.(gba|gbc|gb)$/i))
    .map(f => {
      const stat = fs.statSync(path.join(ROMS_DIR, f));
      return { name: f, size: stat.size, updatedAt: stat.mtime.toISOString() };
    });

  res.json(roms);
});

// Download a ROM
romRouter.get('/:name', (req, res) => {
  const filePath = path.join(ROMS_DIR, req.params.name);

  if (!fs.existsSync(filePath)) {
    res.status(404).send('Not found');
    return;
  }

  res.setHeader('Content-Type', 'application/octet-stream');
  res.sendFile(filePath);
});

// Upload a ROM
romRouter.put('/:name', (req, res) => {
  const filePath = path.join(ROMS_DIR, req.params.name);
  const chunks: Buffer[] = [];

  req.on('data', (chunk: Buffer) => chunks.push(chunk));
  req.on('end', () => {
    fs.writeFileSync(filePath, Buffer.concat(chunks));
    console.log(`ROM uploaded: ${req.params.name} (${Buffer.concat(chunks).length} bytes)`);
    res.json({ ok: true });
  });
});
