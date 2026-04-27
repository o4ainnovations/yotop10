'use client';

import Link from 'next/link';
import { API } from '@/lib/api';
import { getFingerprint } from '@/lib/fingerprint';

export default function Home() {
  return (
    <div>
      <h1>YoTop10</h1>
      <p>An open Wikipedia-style platform for top 10 lists with a social UI. Anyone can browse, submit, and comment without creating an account.</p>

      <h2>Navigation</h2>
      <ul>
        <li><Link href="/submit">Create a Post</Link></li>
        <li><Link href="/categories">Categories</Link></li>
        <li><Link href="/a/test">Profile Page</Link></li>
      </ul>

      <h2>API Endpoints (Backend)</h2>
      <ul>
        <li>GET /api/categories - List all categories</li>
        <li>GET /api/categories/:slug - Get single category</li>
        <li>GET /api/posts - List approved posts</li>
        <li>GET /api/posts/:slug - Get single post with items and comments</li>
        <li>POST /api/posts - Submit new post (anonymous)</li>
        <li>GET /api/posts/check-title - Check for similar titles</li>
        <li>GET /api/posts/:slug/comments - Comments for post</li>
        <li>POST /api/posts/:slug/comments - Add comment (anonymous)</li>
        <li>PATCH /api/comments/:id - Edit own comment (2hr window)</li>
        <li>DELETE /api/comments/:id - Delete own comment</li>
        <li>POST /api/reactions - Toggle fire reaction</li>
        <li>GET /api/reactions/state - Get reaction states</li>
        <li>GET /api/users/me - Current user context</li>
        <li>GET /api/users/me/rate-limits - Current user rate limit status</li>
        <li>GET /api/arguments - Hot debates</li>
        <li>GET /api/hall-of-fame - Featured lists</li>
      </ul>
    </div>
  );
}
