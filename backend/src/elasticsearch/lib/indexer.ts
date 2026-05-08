import { es } from '../../lib/elasticsearch';

const INDEX_PREFIX = 'yotop10';

const MAPPINGS = {
  posts: {
    title: { type: 'text', analyzer: 'english' },
    intro: { type: 'text', analyzer: 'english' },
    items: { type: 'nested', properties: { title: { type: 'text', analyzer: 'english' }, justification: { type: 'text', analyzer: 'english' } } },
    category_slug: { type: 'keyword' },
    author_username: { type: 'keyword' },
    author_display_name: { type: 'text' },
    post_type: { type: 'keyword' },
    status: { type: 'keyword' },
    slug: { type: 'keyword' },
    fire_count: { type: 'integer' },
    comment_count: { type: 'integer' },
    view_count: { type: 'integer' },
    created_at: { type: 'date' },
    published_at: { type: 'date' },
    featured: { type: 'boolean' },
  },
  comments: {
    content: { type: 'text', analyzer: 'english' },
    author_username: { type: 'keyword' },
    post_id: { type: 'keyword' },
    post_title: { type: 'text' },
    post_slug: { type: 'keyword' },
    spark_score: { type: 'float' },
    fire_count: { type: 'integer' },
    reply_count: { type: 'integer' },
    depth: { type: 'integer' },
    is_item_anchored: { type: 'boolean' },
    flag_type: { type: 'keyword' },
    created_at: { type: 'date' },
  },
  categories: {
    name: { type: 'text', analyzer: 'english' },
    slug: { type: 'keyword' },
    description: { type: 'text', analyzer: 'english' },
    post_count: { type: 'integer' },
  },
  users: {
    username: { type: 'keyword' },
    display_name: { type: 'text' },
    trust_score: { type: 'float' },
    created_at: { type: 'date' },
  },
};

export async function ensureIndices(): Promise<void> {
  for (const [name, properties] of Object.entries(MAPPINGS)) {
    const indexName = `${INDEX_PREFIX}_${name}`;
    const exists = await es.indices.exists({ index: indexName });
    if (!exists) {
      await es.indices.create({ index: indexName, body: { mappings: { properties } } });
      console.log(`[Search] Created index: ${indexName}`);
    }
  }
}

export { INDEX_PREFIX };
