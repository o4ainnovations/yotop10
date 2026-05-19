'use client';

import { useSlideMenu } from '@/stores/slideMenu';
import { Icon } from './icons/Icon';

export function SlideMenuTrigger() {
  const setOpen = useSlideMenu((s) => s.setOpen);

  return (
    <button
      onClick={() => setOpen(true)}
      onPointerDown={(e) => { e.preventDefault(); setOpen(true); }}
      className="sm:hidden text-zinc-400 hover:text-white transition min-w-[44px] min-h-[44px] flex items-center justify-center focus:outline-none"
      aria-label="Menu"
    >
      <Icon name="Menu" size={22} />
    </button>
  );
}
