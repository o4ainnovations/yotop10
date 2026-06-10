import { API } from '@/lib/api';
import { redirect, notFound } from 'next/navigation';
import UserProfileClient from './client';

interface UserProfile {
  username: string;
  canonical_url?: string;
  profile_image_url?: string | null;
  trust_level: 'newbie' | 'ghost' | 'troll' | 'neutral' | 'scholar';
  created_at: string;
  stats: {
    member_since: string;
    total_posts: number;
    total_comments: number;
    approval_rate: number;
  };
  posts: Array<{
    id: string;
    title: string;
    slug: string;
    status: string;
    post_type: string;
    comment_count: number;
    created_at: string;
    category: { name?: string; slug: string } | null;
    revision_guidance?: string;
    rejection_reason?: string;
  }>;
  comments: Array<{
    id: string;
    content: string;
    post_id: string;
    fire_count: number;
    reply_count: number;
    created_at: string;
  }>;
  is_own_profile: boolean;
  trust_score?: number;
}

type PageProps = {
  params: Promise<{ username: string }>;
};

export default async function UserProfileServer({ params }: PageProps) {
  const { username } = await params;

  let profile: UserProfile | null = null;
  try {
    profile = await API.getUserProfile(username) as UserProfile;
  } catch {
    notFound();
  }

  if (!profile) notFound();
  if (profile.canonical_url && profile.canonical_url !== `/a/${username}`) {
    redirect(profile.canonical_url);
  }

  return <UserProfileClient initialProfile={profile} />;
}
