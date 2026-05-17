'use client';

import { useEffect } from 'react';
import { registerSW } from '@/app/sw-register';

export default function SWRegister() {
  useEffect(() => {
    registerSW();
  }, []);

  return null;
}
