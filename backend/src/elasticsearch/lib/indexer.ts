/* eslint-disable no-restricted-syntax, @typescript-eslint/no-explicit-any -- ES client types reject dynamic body objects */
import { es } from '../../lib/elasticsearch';

const INDEX_PREFIX = 'yotop10';

const MAPPINGS = {
  posts: {
    title: { type: 'text' as const, analyzer: 'english' as const },
    intro: { type: 'text' as const, analyzer: 'english' as const },
    items: { type: 'nested' as const, properties: { title: { type: 'text' as const, analyzer: 'english' as const }, justification: { type: 'text' as const, analyzer: 'english' as const } } },
    category_slug: { type: 'keyword' as const },
    author_username: { type: 'keyword' as const },
    author_display_name: { type: 'text' as const },
    post_type: { type: 'keyword' as const },
    status: { type: 'keyword' as const },
    slug: { type: 'keyword' as const },
    fire_count: { type: 'integer' as const },
    comment_count: { type: 'integer' as const },
    view_count: { type: 'integer' as const },
    created_at: { type: 'date' as const },
    published_at: { type: 'date' as const },
    featured: { type: 'boolean' as const },
  },
  comments: {
    content: { type: 'text' as const, analyzer: 'english' as const },
    author_username: { type: 'keyword' as const },
    post_id: { type: 'keyword' as const },
    post_title: { type: 'text' as const },
    post_slug: { type: 'keyword' as const },
    spark_score: { type: 'float' as const },
    fire_count: { type: 'integer' as const },
    reply_count: { type: 'integer' as const },
    depth: { type: 'integer' as const },
    is_item_anchored: { type: 'boolean' as const },
    flag_type: { type: 'keyword' as const },
    created_at: { type: 'date' as const },
  },
  categories: {
    name: { type: 'text' as const, analyzer: 'english' as const },
    slug: { type: 'keyword' as const },
    description: { type: 'text' as const, analyzer: 'english' as const },
    post_count: { type: 'integer' as const },
  },
  users: {
    username: { type: 'keyword' as const },
    display_name: { type: 'text' as const },
    trust_score: { type: 'float' as const },
    created_at: { type: 'date' as const },
  },
};

export async function ensureIndices(): Promise<void> {
  for (const [name, properties] of Object.entries(MAPPINGS)) {
    const indexName = `${INDEX_PREFIX}_${name}`;
    const exists = await es.indices.exists({ index: indexName });
    if (!exists) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- ES client types don't accept mapped literal unions
      await es.indices.create({ index: indexName, body: { mappings: { properties } } } as any);
      console.log(`[Search] Created index: ${indexName}`);
    }
  }
}

export { INDEX_PREFIX };
