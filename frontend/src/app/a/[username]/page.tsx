import { cookies } from 'next/headers';
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
    approval_rate: number | null;
    verified?: boolean;
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

  // Strip a_ prefix to normalize URLs — prevents flash redirect
  if (username.startsWith('a_')) {
    redirect(`/a/${username.slice(2)}`);
  }

  // Forward device_fingerprint cookie so backend can identify the viewer
  const cookieStore = await cookies();
  const fpCookie = cookieStore.get('device_fingerprint')?.value || '';
  const baseUrl = process.env.INTERNAL_API_URL || 'http://backend:8000/api';

  let profile: UserProfile | null = null;
  try {
    const res = await fetch(`${baseUrl}/users/${username}`, {
      headers: fpCookie ? { Cookie: `device_fingerprint=${fpCookie}` } : {},
      cache: 'no-store',
    });
    if (!res.ok) notFound();
    profile = await res.json() as UserProfile;
  } catch {
    notFound();
  }

  if (!profile) notFound();
  if (profile.canonical_url && profile.canonical_url !== `/a/${username}`) {
    redirect(profile.canonical_url);
  }

  return <UserProfileClient initialProfile={profile} />;
}
