import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isUsernameAvailable, recordUsernameChange } from './usernameService';
import { User } from '../models/User';
import { UsernameHistory } from '../models/UsernameHistory';

vi.mock('../models/User', () => ({
  User: {
    findOne: vi.fn(),
  },
}));

vi.mock('../models/UsernameHistory', () => ({
  UsernameHistory: {
    create: vi.fn().mockResolvedValue({}),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(UsernameHistory.create).mockResolvedValue({});
});

describe('usernameService', () => {
  describe('isUsernameAvailable', () => {
    it('returns available=true when no user has the username', async () => {
      vi.mocked(User.findOne).mockResolvedValue(null);
      const result = await isUsernameAvailable('newuser');
      expect(result).toEqual({ available: true });
      expect(User.findOne).toHaveBeenCalledWith({
        $or: [
          { username: 'newuser' },
          { custom_display_name: 'newuser' },
        ],
      });
    });

    it('returns available=false when another user has the username', async () => {
      vi.mocked(User.findOne).mockResolvedValue({
        user_id: 'other123',
        username: 'takenname',
      });
      const result = await isUsernameAvailable('takenname');
      expect(result).toEqual({ available: false });
    });

    it('returns available=true when the current user owns the username', async () => {
      vi.mocked(User.findOne).mockResolvedValue({
        user_id: 'user123',
        username: 'myname',
      });
      const result = await isUsernameAvailable('myname', 'user123');
      expect(result).toEqual({ available: true });
    });

    it('returns available=false when the username is taken by someone else (with currentUserId)', async () => {
      vi.mocked(User.findOne).mockResolvedValue({
        user_id: 'other456',
        username: 'desiredname',
      });
      const result = await isUsernameAvailable('desiredname', 'user123');
      expect(result).toEqual({ available: false });
    });

    it('checks both username and custom_display_name fields', async () => {
      vi.mocked(User.findOne).mockResolvedValue({
        user_id: 'other789',
        custom_display_name: 'displayname',
        username: 'different',
      });
      const result = await isUsernameAvailable('displayname');
      expect(result).toEqual({ available: false });
      expect(User.findOne).toHaveBeenCalledWith({
        $or: [
          { username: 'displayname' },
          { custom_display_name: 'displayname' },
        ],
      });
    });

    it('allows same user when matched via custom_display_name', async () => {
      vi.mocked(User.findOne).mockResolvedValue({
        user_id: 'user123',
        username: 'othername',
        custom_display_name: 'mydisplay',
      });
      const result = await isUsernameAvailable('mydisplay', 'user123');
      expect(result).toEqual({ available: true });
    });

    it('handles DB query failure by propagating the error', async () => {
      vi.mocked(User.findOne).mockRejectedValue(new Error('DB connection lost'));
      await expect(isUsernameAvailable('anyname')).rejects.toThrow('DB connection lost');
    });
  });

  describe('recordUsernameChange', () => {
    it('creates a UsernameHistory entry for the new username', async () => {
      await recordUsernameChange('user123', 'new_handle', 'old_handle');
      expect(UsernameHistory.create).toHaveBeenCalledTimes(2);
      expect(UsernameHistory.create).toHaveBeenNthCalledWith(1, {
        user_id: 'user123',
        username: 'new_handle',
        custom_display_name: 'new_handle',
        previous_username: 'old_handle',
        released_at: null,
      });
    });

    it('marks the old username as released', async () => {
      await recordUsernameChange('user123', 'new_handle', 'old_handle');
      expect(UsernameHistory.create).toHaveBeenNthCalledWith(2, {
        user_id: 'user123',
        username: 'old_handle',
        custom_display_name: 'old_handle',
        previous_username: null,
        released_at: expect.any(Date),
      });
    });

    it('only creates one entry when oldUsername is null (first-time setup)', async () => {
      await recordUsernameChange('user123', 'first_handle', null);
      expect(UsernameHistory.create).toHaveBeenCalledTimes(1);
      expect(UsernameHistory.create).toHaveBeenCalledWith({
        user_id: 'user123',
        username: 'first_handle',
        custom_display_name: 'first_handle',
        previous_username: null,
        released_at: null,
      });
    });

    it('does not create a release entry when oldUsername is null', async () => {
      await recordUsernameChange('user123', 'first_handle', null);
      const calls = vi.mocked(UsernameHistory.create).mock.calls;
      const hasReleaseEntry = calls.some((call) => {
        const params = call[0] as Record<string, unknown>;
        return params.released_at !== null;
      });
      expect(hasReleaseEntry).toBe(false);
    });

    it('sets released_at to current date for old username', async () => {
      const before = Date.now();
      await recordUsernameChange('user123', 'new', 'old');
      const after = Date.now();
      const releaseCall = vi.mocked(UsernameHistory.create).mock.calls[1][0] as Record<string, unknown>;
      const releasedAt = releaseCall.released_at as Date;
      expect(releasedAt.getTime()).toBeGreaterThanOrEqual(before);
      expect(releasedAt.getTime()).toBeLessThanOrEqual(after);
    });

    it('propagates DB errors from UsernameHistory.create', async () => {
      vi.mocked(UsernameHistory.create).mockRejectedValue(new Error('Write failed'));
      await expect(recordUsernameChange('user123', 'new', 'old')).rejects.toThrow('Write failed');
    });
  });
});
