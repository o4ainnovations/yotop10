'use client';

import { useEffect } from 'react';
import { useParams, redirect } from 'next/navigation';
import { API } from '@/lib/api';

export default function PostHistoryRedirectPage() {
  const params = useParams();
  const id = params?.id as string;

  useEffect(() => {
    const redirectToSlug = async () => {
      try {
        const data = await API.getPost(id);
        if (data?.post?.slug) {
          redirect(`/${data.post.slug}/history`);
        }
      } catch {
        // Fallback if post not found
        redirect('/');
      }
    };

    redirectToSlug();
  }, [id]);

  return <div>Redirecting...</div>;
}