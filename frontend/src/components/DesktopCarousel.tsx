'use client';

import { useRef, useState, useEffect } from 'react';
import { PostCarouselCard } from '@/components/PostCarouselCard';
import { Icon } from '@/components/icons/Icon';
import type { PostsResponse } from '@/lib/api/types';

interface DesktopCarouselProps {
  posts: PostsResponse['posts'];
}

export function DesktopCarousel({ posts }: DesktopCarouselProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
    setCanScrollLeft(scrollLeft > 0);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
  };

  useEffect(() => {
    checkScroll();
    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', checkScroll);
      window.addEventListener('resize', checkScroll);
      return () => {
        container.removeEventListener('scroll', checkScroll);
        window.removeEventListener('resize', checkScroll);
      };
    }
  }, []);

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollContainerRef.current) return;
    const scrollAmount = 500;
    scrollContainerRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  return (
    <div className="pb-24">
      {posts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5">
            <Icon name="FileText" size={24} className="text-zinc-600" />
          </div>
          <h3 className="mb-2 text-base font-semibold text-zinc-300">No ranked lists yet.</h3>
        </div>
      ) : (
        <div className="relative flex justify-end">
          {/* Left Arrow */}
          {canScrollLeft && (
            <button
              onClick={() => scroll('left')}
              className="absolute left-0 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/50 p-2 transition hover:bg-black/70"
              aria-label="Scroll left"
            >
              <Icon name="ChevronLeft" size={24} className="text-white" />
            </button>
          )}

          {/* Carousel Container */}
          <div
            ref={scrollContainerRef}
            className="flex flex-row overflow-x-auto overflow-y-hidden gap-3 py-6 px-8 -webkit-overflow-scrolling-touch snap-x snap-mandatory scroll-smooth scrollbar-hide"
            style={{ scrollBehavior: 'smooth' }}
          >
            {posts.map((post) => (
              <div key={post.id} className="flex-shrink-0 w-[464px] aspect-square scroll-snap-align-start">
                <PostCarouselCard post={post} />
              </div>
            ))}
          </div>

          {/* Right Arrow */}
          {canScrollRight && (
            <button
              onClick={() => scroll('right')}
              className="absolute right-0 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/50 p-2 transition hover:bg-black/70"
              aria-label="Scroll right"
            >
              <Icon name="ChevronRight" size={24} className="text-white" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
