'use client';

import { useSlideMenu } from '@/stores/slideMenu';
import { Icon } from './icons/Icon';

export function SlideMenuTrigger() {
  const setOpen = useSlideMenu((s) => s.setOpen);

  return (
    <button
      onClick={() => setOpen(true)}
      onPointerDown={(e) => { e.preventDefault(); setOpen(true); }}
      className="lg:hidden text-zinc-400 hover:text-white transition min-w-11 min-h-11 flex items-center justify-center focus:outline-none"
      aria-label="Menu"
    >
      <Icon name="Menu" size={22} />
    </button>
  );
}
