import { describe, it, expect, vi, beforeEach } from 'vitest';
import { seedPresets } from './seedPresets';

const mockCountDocuments = vi.fn();
const mockInsertMany = vi.fn();

vi.mock('../models/PermissionPreset', () => ({
  PermissionPreset: {
    countDocuments: (...args: unknown[]) => mockCountDocuments(...args),
    insertMany: (...args: unknown[]) => mockInsertMany(...args),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('seedPresets', () => {
  it('creates exactly 4 presets when collection is empty', async () => {
    mockCountDocuments.mockResolvedValue(0);
    mockInsertMany.mockResolvedValue([]);

    await seedPresets();

    expect(mockCountDocuments).toHaveBeenCalledTimes(1);
    expect(mockInsertMany).toHaveBeenCalledTimes(1);
    const docs = mockInsertMany.mock.calls[0][0];
    expect(docs).toHaveLength(4);
  });

  it('is idempotent — second call does not create duplicates', async () => {
    mockCountDocuments.mockResolvedValue(4);

    await seedPresets();

    expect(mockCountDocuments).toHaveBeenCalledTimes(1);
    expect(mockInsertMany).not.toHaveBeenCalled();
  });

  it('does nothing when presets already exist (count > 0)', async () => {
    mockCountDocuments.mockResolvedValue(1);

    await seedPresets();

    expect(mockCountDocuments).toHaveBeenCalledTimes(1);
    expect(mockInsertMany).not.toHaveBeenCalled();
  });

  it('no errors when called multiple times', async () => {
    for (let i = 0; i < 5; i++) {
      if (i === 0) {
        mockCountDocuments.mockResolvedValue(0);
        mockInsertMany.mockResolvedValue([]);
      } else {
        mockCountDocuments.mockResolvedValue(4);
      }

      await expect(seedPresets()).resolves.toBeUndefined();
    }
  });

  it('presets have correct names', async () => {
    mockCountDocuments.mockResolvedValue(0);
    mockInsertMany.mockResolvedValue([]);

    await seedPresets();

    const docs = mockInsertMany.mock.calls[0][0];
    const names = docs.map((d: { name: string }) => d.name);

    expect(names).toContain('Read-Only Auditor');
    expect(names).toContain('Content Moderator');
    expect(names).toContain('Full Moderator');
    expect(names).toContain('Community Manager');
    expect(names).toHaveLength(4);
  });

  it('presets have correct permission counts', async () => {
    mockCountDocuments.mockResolvedValue(0);
    mockInsertMany.mockResolvedValue([]);

    await seedPresets();

    const docs = mockInsertMany.mock.calls[0][0];

    const readOnly = docs.find((d: { name: string }) => d.name === 'Read-Only Auditor');
    expect(readOnly.permissions).toHaveLength(3);

    const contentMod = docs.find((d: { name: string }) => d.name === 'Content Moderator');
    expect(contentMod.permissions).toHaveLength(11);

    const fullMod = docs.find((d: { name: string }) => d.name === 'Full Moderator');
    expect(fullMod.permissions).toHaveLength(22);

    const communityMgr = docs.find((d: { name: string }) => d.name === 'Community Manager');
    expect(communityMgr.permissions).toHaveLength(10);
  });

  it('Read-Only Auditor has only read permissions', async () => {
    mockCountDocuments.mockResolvedValue(0);
    mockInsertMany.mockResolvedValue([]);

    await seedPresets();

    const docs = mockInsertMany.mock.calls[0][0];
    const readOnly = docs.find((d: { name: string }) => d.name === 'Read-Only Auditor');
    expect(readOnly.permissions).toEqual(['dashboard:read', 'statistics:read', 'audit:read']);
  });

  it('Content Moderator has comment moderation permissions', async () => {
    mockCountDocuments.mockResolvedValue(0);
    mockInsertMany.mockResolvedValue([]);

    await seedPresets();

    const docs = mockInsertMany.mock.calls[0][0];
    const contentMod = docs.find((d: { name: string }) => d.name === 'Content Moderator');
    expect(contentMod.permissions).toContain('posts:approve');
    expect(contentMod.permissions).toContain('comments:moderate');
    expect(contentMod.permissions).toContain('comments:penalty');
  });

  it('Full Moderator does not have user/config access', async () => {
    mockCountDocuments.mockResolvedValue(0);
    mockInsertMany.mockResolvedValue([]);

    await seedPresets();

    const docs = mockInsertMany.mock.calls[0][0];
    const fullMod = docs.find((d: { name: string }) => d.name === 'Full Moderator');
    expect(fullMod.permissions).not.toContain('users:read');
    expect(fullMod.permissions).not.toContain('users:restrict');
    expect(fullMod.permissions).not.toContain('users:trust');
    expect(fullMod.permissions).not.toContain('config:read');
    expect(fullMod.permissions).not.toContain('config:write');
  });

  it('Community Manager has user management permissions', async () => {
    mockCountDocuments.mockResolvedValue(0);
    mockInsertMany.mockResolvedValue([]);

    await seedPresets();

    const docs = mockInsertMany.mock.calls[0][0];
    const communityMgr = docs.find((d: { name: string }) => d.name === 'Community Manager');
    expect(communityMgr.permissions).toContain('users:read');
    expect(communityMgr.permissions).toContain('users:restrict');
    expect(communityMgr.permissions).toContain('users:trust');
    expect(communityMgr.permissions).toContain('hof:read');
    expect(communityMgr.permissions).toContain('hof:manage');
  });

  it('all presets have name, description, and permissions', async () => {
    mockCountDocuments.mockResolvedValue(0);
    mockInsertMany.mockResolvedValue([]);

    await seedPresets();

    const docs = mockInsertMany.mock.calls[0][0];
    for (const preset of docs) {
      expect(preset).toHaveProperty('name');
      expect(typeof preset.name).toBe('string');
      expect(preset.name.length).toBeGreaterThan(0);
      expect(preset).toHaveProperty('description');
      expect(typeof preset.description).toBe('string');
      expect(preset).toHaveProperty('permissions');
      expect(Array.isArray(preset.permissions)).toBe(true);
      expect(preset.permissions.length).toBeGreaterThan(0);
    }
  });

  it('preset names are unique', async () => {
    mockCountDocuments.mockResolvedValue(0);
    mockInsertMany.mockResolvedValue([]);

    await seedPresets();

    const docs = mockInsertMany.mock.calls[0][0];
    const names = docs.map((d: { name: string }) => d.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('count is checked before insertion (guard clause test)', async () => {
    mockCountDocuments.mockResolvedValue(4);

    await seedPresets();

    expect(mockCountDocuments).toHaveBeenCalledTimes(1);
    expect(mockInsertMany).not.toHaveBeenCalled();
  });

  it('when count is zero, all 4 presets are inserted', async () => {
    mockCountDocuments.mockResolvedValue(0);
    mockInsertMany.mockResolvedValue([]);

    await seedPresets();

    expect(mockInsertMany).toHaveBeenCalledTimes(1);
    expect(mockInsertMany.mock.calls[0][0].length).toBe(4);
  });
});
