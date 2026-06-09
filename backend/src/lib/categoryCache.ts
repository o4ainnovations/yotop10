import { Category } from '../models/Category';
import { redis } from './redis';

const CATEGORY_CACHE_KEY = 'cache:categories:names';
const CATEGORY_CACHE_TTL = 300; // 5 minutes

let localCache: Map<string, string> | null = null;

async function loadCategoriesFromDb(): Promise<Map<string, string>> {
  const categories = await Category.find({}).select('slug name').lean();
  const map = new Map<string, string>();
  for (const cat of categories) {
    map.set(cat.slug, cat.name);
  }
  // Populate Redis cache asynchronously (non-blocking)
  redis.setEx(CATEGORY_CACHE_KEY, CATEGORY_CACHE_TTL, JSON.stringify(Array.from(map.entries())))
    .catch((err) => console.error('[CategoryCache] Redis write failed:', err.message));
  localCache = map;
  return map;
}

export async function getCategoryNameMap(): Promise<Map<string, string>> {
  // Try local in-memory cache first (fastest)
  if (localCache !== null) return localCache;

  // Try Redis cache
  try {
    const cached = await redis.get(CATEGORY_CACHE_KEY);
    if (cached) {
      const entries: Array<[string, string]> = JSON.parse(cached);
      const map = new Map<string, string>(entries);
      localCache = map;
      return map;
    }
  } catch {
    // Redis unavailable — fall through to DB
  }

  // Cache miss — load from DB
  return loadCategoriesFromDb();
}

export function invalidateCategoryCache(): void {
  localCache = null;
  redis.del(CATEGORY_CACHE_KEY).catch(() => {});
}
