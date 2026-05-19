'use client';

import { useState } from 'react';
import { Icon } from './icons/Icon';

export function MobileMenu() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Hamburger — only mobile */}
      <button
        onClick={() => setOpen(true)}
        className="text-zinc-400 hover:text-white transition min-w-[44px] min-h-[44px] flex items-center justify-center focus:outline-none"
        aria-label="Menu"
      >
        <Icon name="Menu" size={22} />
      </button>

      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Slide-out panel from right */}
      <div
        className={`fixed top-0 right-0 z-[70] h-full w-72 bg-[#05050f] border-l border-white/5 shadow-2xl transform transition-transform duration-300 ease-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <span className="text-sm font-semibold text-zinc-400">Menu</span>
          <button
            onClick={() => setOpen(false)}
            className="text-zinc-500 hover:text-white transition min-w-[44px] min-h-[44px] flex items-center justify-center focus:outline-none"
            aria-label="Close"
          >
            <Icon name="X" size={20} />
          </button>
        </div>

        {/* Content — empty for now */}
        <div className="px-5 py-6">
          <p className="text-sm text-zinc-600">Nothing here yet.</p>
        </div>
      </div>
    </>
  );
}
