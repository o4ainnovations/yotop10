'use client';

import Link from 'next/link';
import { Icon } from './icons/Icon';

interface PostPendingClientProps {
  title: string;
  rejectionReason?: string;
  isRejected: boolean;
  postId?: string;
  queueNumber?: number;
}

export default function PostPendingClient({ title, rejectionReason, isRejected, postId, queueNumber }: PostPendingClientProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-6 text-center">
      <div className="mb-6 inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-white/5">
        {isRejected ? (
          <Icon name="X" size={36} className="text-red-500" />
        ) : (
          <Icon name="Clock" size={36} className="text-orange-400" />
        )}
      </div>

      <h1 className="mb-2 text-xl font-bold text-white">
        {isRejected ? 'Post Rejected' : 'Post Pending Review'}
      </h1>

      <p className="mb-2 text-sm text-zinc-400 leading-relaxed max-w-md">
        &ldquo;{title}&rdquo;
      </p>

      {!isRejected && queueNumber && queueNumber > 0 && (
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-orange-500/20 bg-orange-500/10 px-4 py-1.5 text-sm font-mono text-orange-400">
          <Icon name="Hash" size={14} />
          #{queueNumber} in review queue
        </div>
      )}

      {!isRejected && postId && (
        <p className="mb-1 text-3xs text-zinc-700 font-mono">ID: {postId}</p>
      )}

      <p className="mb-8 text-sm text-zinc-600 leading-relaxed max-w-md">
        {isRejected
          ? 'This post was not approved. Check the reason below or contact the moderation team.'
          : 'This post has been submitted and is awaiting review by the moderation team. It will be visible once approved.'}
      </p>

      {isRejected && rejectionReason && (
        <div className="mb-8 max-w-md w-full rounded-xl border border-red-500/20 bg-red-500/5 px-5 py-4 text-left">
          <p className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-1">Reason</p>
          <p className="text-sm text-zinc-300">{rejectionReason}</p>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={() => window.history.back()}
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium text-zinc-300 backdrop-blur-sm transition hover:border-white/20 hover:bg-white/10"
        >
          <Icon name="ArrowLeft" size={16} />
          Go Back
        </button>

        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-pink-500 px-5 py-3 text-sm font-bold text-white shadow-lg transition hover:shadow-xl"
        >
          <Icon name="House" size={16} />
          Continue to Homepage
        </Link>
      </div>
    </div>
  );
}
