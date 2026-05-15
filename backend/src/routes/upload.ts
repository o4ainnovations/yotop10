/* eslint-disable no-restricted-syntax, @typescript-eslint/no-explicit-any -- Express middleware type chains */
import { Router } from 'express';
import { upload, processUpload, processProfileImage } from '../lib/upload';

const router: Router = Router();

router.post('/', upload.single('file'), async (req: any, res: any) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const variants = await processUpload(req.file.path);

    res.status(201).json({
      success: true,
      file: {
        original: variants.original,
        item_thumb: variants.item_thumb,
        hero_lg: variants.hero_lg,
      },
    });
  } catch (e: any) {
    if (e?.message?.includes('File type')) {
      return res.status(400).json({ error: e.message });
    }
    res.status(500).json({ error: 'Upload failed' });
  }
});

router.post('/profile', upload.single('file'), async (req: any, res: any) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const url = await processProfileImage(req.file.path);

    res.status(201).json({
      success: true,
      url,
    });
  } catch (e: any) {
    if (e?.message?.includes('File type')) {
      return res.status(400).json({ error: e.message });
    }
    res.status(500).json({ error: 'Upload failed' });
  }
});

export default router;
