import { es } from './elasticsearch';
import { Post } from '../models/Post';
import { checkTitleMatch } from './titleSimilarity';
import { INDEX_PREFIX } from '../elasticsearch/lib/indexer';

const ES_MAX_CANDIDATES = 50;
const FALLBACK_MAX_POSTS = 500;
const FALLBACK_DAYS = 90;

export interface SimilarTitle {
  title: string;
  slug: string;
  categorySlug?: string;
  similarity: number;
}

async function searchViaEs(
  queryTitle: string,
  excludePostId?: string
): Promise<SimilarTitle[]> {
  try {
    const esResults = await es.search({
      index: `${INDEX_PREFIX}_posts`,
      body: {
        query: {
          bool: {
            must: {
              match: {
                title: {
                  query: queryTitle,
                  fuzziness: 'AUTO',
                  prefix_length: 2,
                  minimum_should_match: '75%',
                },
              },
            },
            filter: [
              { term: { status: 'approved' } },
              ...(excludePostId ? [{ bool: { must_not: { term: { _id: excludePostId } } } }] : []),
            ],
          },
        },
        _source: ['title', 'slug', 'category_slug'],
        size: ES_MAX_CANDIDATES,
        min_score: 3.0,
      },
    });

    const hits = (esResults.hits.hits as Array<{
      _id: string;
      _source: { title: string; slug: string; category_slug?: string };
      _score: number;
    }>);

    if (hits.length === 0) return [];

    const results: SimilarTitle[] = [];
    for (const hit of hits) {
      const result = checkTitleMatch(queryTitle, hit._source.title);
      if (result.isDuplicate) {
        results.push({
          title: hit._source.title,
          slug: hit._source.slug,
          categorySlug: hit._source.category_slug,
          similarity: result.similarity,
        });
      }
    }
    return results;
  } catch (err) {
    console.warn('[TitleCheck] ES search failed, falling back to MongoDB:', (err as Error).message);
    return [];
  }
}

async function searchViaMongo(queryTitle: string): Promise<SimilarTitle[]> {
  try {
    const cutoff = new Date(Date.now() - FALLBACK_DAYS * 24 * 60 * 60 * 1000);
    const posts = await Post.find({
      status: 'approved',
      created_at: { $gte: cutoff },
    })
      .select('title slug category_slug')
      .limit(FALLBACK_MAX_POSTS)
      .lean();

    const results: SimilarTitle[] = [];
    for (const post of posts) {
      const title = post.title as string;
      const result = checkTitleMatch(queryTitle, title);
      if (result.isDuplicate) {
        results.push({
          title,
          slug: post.slug as string,
          categorySlug: post.category_slug as string,
          similarity: result.similarity,
        });
      }
    }
    return results;
  } catch (err) {
    console.error('[TitleCheck] MongoDB fallback failed:', (err as Error).message);
    return [];
  }
}

export async function findSimilarTitles(
  queryTitle: string,
  options?: { excludePostId?: string }
): Promise<SimilarTitle[]> {
  const esResults = await searchViaEs(queryTitle, options?.excludePostId);
  if (esResults.length > 0) return esResults;
  return searchViaMongo(queryTitle);
}
