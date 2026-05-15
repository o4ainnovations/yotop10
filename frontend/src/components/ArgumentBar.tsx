'use client';

import { useState, useEffect } from 'react';

interface ArgumentBarProps {
  support: number;
  contradict: number;
}

export function ArgumentBar({ support, contradict }: ArgumentBarProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const total = support + contradict;
  const supportPct = total > 0 ? Math.round((support / total) * 100) : 50;
  const contradictPct = 100 - supportPct;

  return (
    <div>
      <div className="h-2 lg:h-4 rounded-full overflow-hidden bg-white/5 flex">
        <div
          className="argument-bar-support h-full"
          style={{ width: mounted ? `${supportPct}%` : '0%' }}
        />
        <div
          className="argument-bar-contradict h-full"
          style={{ width: mounted ? `${contradictPct}%` : '0%' }}
        />
      </div>
      <div className="text-[10px] font-mono text-zinc-600 flex justify-between mt-1">
        <span>{supportPct}% Support</span>
        <span>{contradictPct}% Contradict</span>
      </div>
    </div>
  );
}
