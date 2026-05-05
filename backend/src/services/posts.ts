import { Post, normalizeTitle, IPost } from '../models/Post';
import { ListItem } from '../models/ListItem';

export interface CreatePostParams {
  author_id: string;
  author_username: string;
  author_display_name: string;
  title: string;
  post_type: string;
  intro: string;
  category_id: string;
  status: 'pending_review' | 'approved';
  items: Array<{ rank: number; title: string; justification: string; source_url?: string }>;
  fire_count?: number;
  view_count?: number;
  published_at?: Date;
}

export async function createPost(params: CreatePostParams): Promise<IPost> {
  const post = await Post.create({
    author_id: params.author_id,
    author_username: params.author_username,
    author_display_name: params.author_display_name,
    title: params.title,
    normalized_title: normalizeTitle(params.title),
    post_type: params.post_type,
    intro: params.intro,
    category_id: params.category_id,
    status: params.status,
    fire_count: params.fire_count ?? 0,
    view_count: params.view_count ?? 0,
    comment_count: 0,
    published_at: params.published_at ?? (params.status === 'approved' ? new Date() : undefined),
  });

  if (params.items.length > 0) {
    await ListItem.insertMany(
      params.items.map((item) => ({
        post_id: post._id,
        rank: item.rank,
        title: item.title,
        justification: item.justification,
        source_url: item.source_url,
        fire_count: 0,
      }))
    );
  }

  return post;
}
