import { UsernameHistory } from '../models/UsernameHistory';
import { User } from '../models/User';

const COOLDOWN_MINUTES = 30;

/**
 * Check if a username is available for use
 */
export async function isUsernameAvailable(username: string, currentUserId?: string, isAdmin?: boolean): Promise<{ available: boolean; cooldown_remaining?: number }> {
  // Check if username is currently in use by any user
  const existingUser = await User.findOne({
    $or: [
      { username },
      { custom_display_name: username },
    ]
  });

  if (existingUser) {
    if (currentUserId && existingUser.user_id === currentUserId) {
      return { available: true };
    }
    return { available: false };
  }

  // Check if username was recently released and still in cooldown
  const lastRelease = await UsernameHistory.findOne({
    $or: [
      { username },
      { custom_display_name: username },
    ],
    released_at: { $ne: null },
  }).sort({ created_at: -1 });

  if (lastRelease && !isAdmin) {
    const now = new Date();
    const releaseTime = new Date(lastRelease.released_at!);
    const cooldownEnd = new Date(releaseTime.getTime() + COOLDOWN_MINUTES * 60 * 1000);
    
    if (now < cooldownEnd) {
      const remainingMs = cooldownEnd.getTime() - now.getTime();
      const remainingMinutes = Math.ceil(remainingMs / 60000);
      return { available: false, cooldown_remaining: remainingMinutes };
    }
  }

  return { available: true };
}

/**
 * Record a username change and mark the old username as released
 */
export async function recordUsernameChange(
  userId: string, 
  newUsername: string, 
  oldUsername: string | null
): Promise<void> {
  // Record the new username
  await UsernameHistory.create({
    user_id: userId,
    username: newUsername,
    custom_display_name: newUsername,
    previous_username: oldUsername,
    released_at: null,
  });

  // Mark the old username as released if it exists
  if (oldUsername) {
    await UsernameHistory.create({
      user_id: userId,
      username: oldUsername,
      custom_display_name: oldUsername,
      previous_username: null,
      released_at: new Date(),
    });
  }
}

/**
 * Find user by any username (current or historical)
 */
export async function resolveUsername(username: string): Promise<string | null> {
  // First try active users
  const activeUser = await User.findOne({
    $or: [
      { user_id: username },
      { user_id: { $regex: `^${username}` } },
      { username },
      { custom_display_name: username },
    ]
  });

  if (activeUser) {
    return activeUser.user_id;
  }

  // Try historical usernames that haven't been re-assigned
  const historyEntry = await UsernameHistory.findOne({
    $or: [
      { username },
      { custom_display_name: username },
    ]
  }).sort({ created_at: -1 });

  if (historyEntry) {
    return historyEntry.user_id;
  }

  return null;
}
