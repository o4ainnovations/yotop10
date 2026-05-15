import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import sharp from 'sharp';
import fs from 'fs/promises';

const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const name = crypto.randomBytes(16).toString('hex');
    cb(null, `${name}${ext}`);
  },
});

const fileFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  if (ALLOWED_MIMES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${file.mimetype} not allowed. Allowed: ${ALLOWED_MIMES.join(', ')}`));
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE },
});

export async function optimizeImage(filePath: string, width: number, height: number): Promise<string> {
  const ext = path.extname(filePath);
  const optimized = filePath.replace(ext, `_${width}x${height}.webp`);

  await sharp(filePath)
    .resize(width, height, { fit: 'cover', position: 'centre' })
    .webp({ quality: 82 })
    .toFile(optimized);

  return `/uploads/${path.basename(optimized)}`;
}

export async function processUpload(filePath: string): Promise<{
  original: string;
  item_thumb: string;
  hero_lg: string;
}> {
  const filename = path.basename(filePath);
  const original = `/uploads/${filename}`;

  const itemThumb = await optimizeImage(filePath, 400, 280);
  const heroLg = await optimizeImage(filePath, 1200, 675);

  return { original, item_thumb: itemThumb, hero_lg: heroLg };
}

export async function processProfileImage(filePath: string): Promise<string> {
  const ext = path.extname(filePath);
  const optimized = filePath.replace(ext, '_profile.webp');

  await sharp(filePath)
    .resize(200, 200, { fit: 'cover', position: 'centre' })
    .webp({ quality: 85 })
    .toFile(optimized);

  return `/uploads/${path.basename(optimized)}`;
}

export async function deleteUploads(urls: string[]): Promise<void> {
  for (const url of urls) {
    if (!url || !url.startsWith('/uploads/')) continue;
    try {
      const filePath = path.join(UPLOAD_DIR, path.basename(url));
      await fs.unlink(filePath);
    } catch {
      /* file already gone */
    }
  }
}
