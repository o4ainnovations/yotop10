'use client';

import { useMemo } from 'react';
import DOMPurify from 'isomorphic-dompurify';

const HIGHLIGHT_TAGS = ['mark'];
const CONTENT_TAGS = ['b', 'i', 'em', 'strong', 'a', 'br'];

export function sanitizeHighlight(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: HIGHLIGHT_TAGS,
    ALLOWED_ATTR: [],
    ALLOW_DATA_ATTR: false,
    FORBID_CONTENTS: ['style', 'script'],
    WHOLE_DOCUMENT: false,
    KEEP_CONTENT: true,
  });
}

export function sanitizeContent(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: CONTENT_TAGS,
    ALLOWED_ATTR: ['href', 'rel', 'target'],
    ALLOW_DATA_ATTR: false,
    FORBID_CONTENTS: ['style', 'script'],
    WHOLE_DOCUMENT: false,
    KEEP_CONTENT: true,
  });
}

interface SafeHTMLProps {
  html: string;
  className?: string;
  variant?: 'highlight' | 'content';
}

export function SafeHTML({ html, className, variant = 'content' }: SafeHTMLProps) {
  const sanitized = useMemo(
    () => (variant === 'highlight' ? sanitizeHighlight(html) : sanitizeContent(html)),
    [html, variant]
  );

  if (!sanitized || sanitized === '') return null;

  return (
    <span
      className={className}
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  );
}
