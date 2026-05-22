'use client';

import { useState, useEffect } from 'react';

interface ArgumentBarProps {
  supportPct: number;
  contradictPct: number;
  className?: string;
}

export function ArgumentBar({ supportPct, contradictPct, className }: ArgumentBarProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isZero = supportPct === 0 && contradictPct === 0;

  return (
    <div className={className}>
      {isZero ? (
        <div className="text-2xs text-zinc-600">No arguments yet</div>
      ) : (
        <>
          <div className="h-2 lg:h-3 rounded-full overflow-hidden bg-white/5 flex">
            <div
              className="argument-bar-support h-full transition-all duration-700 ease-out"
              style={{ width: mounted ? `${supportPct}%` : '0%' }}
            />
            <div
              className="argument-bar-contradict h-full transition-all duration-700 ease-out"
              style={{ width: mounted ? `${contradictPct}%` : '0%' }}
            />
          </div>
          <div className="text-2xs font-mono text-zinc-600 flex justify-between mt-1">
            <span>{supportPct}% support</span>
            <span>{contradictPct}% contradict</span>
          </div>
        </>
      )}
    </div>
  );
}
