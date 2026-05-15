import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockToFile, mockWebp, mockResize, mockSharp, mockUnlink } = vi.hoisted(() => {
  const mockToFile = vi.fn().mockResolvedValue(undefined);
  const mockWebp = vi.fn();
  const mockResize = vi.fn();
  const mockSharp = vi.fn();
  const mockUnlink = vi.fn().mockResolvedValue(undefined);

  mockWebp.mockReturnValue({ toFile: mockToFile });
  mockResize.mockReturnValue({ webp: mockWebp });
  mockSharp.mockReturnValue({ resize: mockResize });

  return { mockToFile, mockWebp, mockResize, mockSharp, mockUnlink };
});

vi.mock('sharp', () => ({ default: mockSharp }));

vi.mock('fs/promises', () => ({ default: { unlink: mockUnlink } }));

import { optimizeImage, processUpload, processProfileImage, deleteUploads } from '../lib/upload';

describe('upload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('optimizeImage', () => {
    it('resizes to given dimensions with cover fit and centre position', async () => {
      const result = await optimizeImage('/some/path/uploads/photo.jpg', 400, 280);

      expect(mockSharp).toHaveBeenCalledWith('/some/path/uploads/photo.jpg');
      expect(mockResize).toHaveBeenCalledWith(400, 280, { fit: 'cover', position: 'centre' });
      expect(mockWebp).toHaveBeenCalledWith({ quality: 82 });
      expect(mockToFile).toHaveBeenCalledWith('/some/path/uploads/photo_400x280.webp');
      expect(result).toBe('/uploads/photo_400x280.webp');
    });

    it('handles different dimensions', async () => {
      await optimizeImage('/uploads/img.png', 1200, 675);

      expect(mockResize).toHaveBeenCalledWith(1200, 675, { fit: 'cover', position: 'centre' });
      expect(mockToFile).toHaveBeenCalledWith('/uploads/img_1200x675.webp');
    });

    it('handles complex file extensions like .jpeg', async () => {
      const result = await optimizeImage('/root/uploads/hero.jpeg', 800, 600);

      expect(mockToFile).toHaveBeenCalledWith('/root/uploads/hero_800x600.webp');
      expect(result).toBe('/uploads/hero_800x600.webp');
    });

    it('propagates sharp errors', async () => {
      mockToFile.mockRejectedValueOnce(new Error('ENOSPC: no space left on device'));

      await expect(optimizeImage('/uploads/bad.jpg', 100, 100)).rejects.toThrow('ENOSPC');
    });
  });

  describe('processUpload', () => {
    it('generates three variants: original, item thumb (400x280), hero lg (1200x675)', async () => {
      const result = await processUpload('/var/uploads/photo.png');

      expect(result).toEqual({
        original: '/uploads/photo.png',
        item_thumb: '/uploads/photo_400x280.webp',
        hero_lg: '/uploads/photo_1200x675.webp',
      });

      expect(mockResize).toHaveBeenCalledTimes(2);
      expect(mockResize).toHaveBeenNthCalledWith(1, 400, 280, { fit: 'cover', position: 'centre' });
      expect(mockResize).toHaveBeenNthCalledWith(2, 1200, 675, { fit: 'cover', position: 'centre' });
    });

    it('handles nested upload paths', async () => {
      const result = await processUpload('/data/uploads/sub/dir/my_file.jpg');

      expect(result.original).toBe('/uploads/my_file.jpg');
      expect(result.item_thumb).toBe('/uploads/my_file_400x280.webp');
    });
  });

  describe('processProfileImage', () => {
    it('resizes to 200x200 with profile suffix', async () => {
      const result = await processProfileImage('/uploads/avatar.jpg');

      expect(mockResize).toHaveBeenCalledWith(200, 200, { fit: 'cover', position: 'centre' });
      expect(mockWebp).toHaveBeenCalledWith({ quality: 85 });
      expect(mockToFile).toHaveBeenCalledWith('/uploads/avatar_profile.webp');
      expect(result).toBe('/uploads/avatar_profile.webp');
    });

    it('uses _profile.webp suffix regardless of original extension', async () => {
      const result = await processProfileImage('/uploads/user123.png');

      expect(mockToFile).toHaveBeenCalledWith('/uploads/user123_profile.webp');
      expect(result).toBe('/uploads/user123_profile.webp');
    });
  });

  describe('deleteUploads', () => {
    it('deletes multiple files from uploads directory', async () => {
      await deleteUploads(['/uploads/photo1.jpg', '/uploads/photo2.webp']);

      expect(mockUnlink).toHaveBeenCalledTimes(2);
      expect(mockUnlink).toHaveBeenNthCalledWith(1, expect.stringContaining('uploads/photo1.jpg'));
      expect(mockUnlink).toHaveBeenNthCalledWith(2, expect.stringContaining('uploads/photo2.webp'));
    });

    it('skips empty strings', async () => {
      await deleteUploads(['', '/uploads/valid.jpg']);

      expect(mockUnlink).toHaveBeenCalledTimes(1);
      expect(mockUnlink).toHaveBeenCalledWith(expect.stringContaining('uploads/valid.jpg'));
    });

    it('skips nullish values', async () => {
      await deleteUploads(['/uploads/a.jpg', '', '/uploads/b.jpg', '']);

      expect(mockUnlink).toHaveBeenCalledTimes(2);
    });

    it('skips URLs not starting with /uploads/', async () => {
      await deleteUploads(['https://cdn.example.com/evil.jpg', '/uploads/safe.jpg']);

      expect(mockUnlink).toHaveBeenCalledTimes(1);
      expect(mockUnlink).toHaveBeenCalledWith(expect.stringContaining('uploads/safe.jpg'));
    });

    it('skips undefined-like strings', async () => {
      await deleteUploads(['/uploads/real.jpg', 'null', 'undefined']);

      expect(mockUnlink).toHaveBeenCalledTimes(1);
    });

    it('swallows deletion errors (file already gone)', async () => {
      mockUnlink.mockRejectedValueOnce(new Error('ENOENT'));

      await deleteUploads(['/uploads/missing.jpg']);

      expect(mockUnlink).toHaveBeenCalledTimes(1);
    });

    it('handles empty array', async () => {
      await deleteUploads([]);

      expect(mockUnlink).not.toHaveBeenCalled();
    });

    it('handles an array with only invalid URLs', async () => {
      await deleteUploads(['', 'https://external.com/img.jpg']);

      expect(mockUnlink).not.toHaveBeenCalled();
    });
  });
});
