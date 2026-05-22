'use client';

import Link from 'next/link';
import { ReactNode } from 'react';

interface CtaButtonProps {
  href: string;
  children: ReactNode;
}

export default function CtaButton({ href, children }: CtaButtonProps) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-pink-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-orange-500/25 transition hover:shadow-xl hover:shadow-orange-500/40 active:scale-[0.98]"
    >
      {children}
    </Link>
  );
}
