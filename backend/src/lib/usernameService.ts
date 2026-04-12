import { UsernameHistory } from '../models/UsernameHistory';
import { User } from '../models/User';

/**
 * Check if a username is available for use
 */
export async function isUsernameAvailable(username: string, currentUserId?: string): Promise<{ available: boolean }> {
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

  return { available: true };
}

/**
 * Record a username change for history tracking
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
