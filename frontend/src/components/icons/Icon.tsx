'use client';

import React from 'react';
import { icons as lucideIcons, type LucideProps } from 'lucide-react';

type LucideIconName = keyof typeof lucideIcons;
type IconVariant = 'outline' | 'solid' | 'duotone';

interface IconProps extends Omit<LucideProps, 'ref'> {
  name: LucideIconName;
  variant?: IconVariant;
}

const DUOTONE_OPACITY = 0.15;
const OUTLINE_STROKE = 2.5;

export function Icon({ name, variant = 'outline', size = 18, strokeWidth, ...props }: IconProps) {
  const IconComponent = lucideIcons[name] as React.ComponentType<LucideProps>;

  if (!IconComponent) return null;

  const sw = strokeWidth ?? (variant === 'outline' || variant === 'duotone' ? OUTLINE_STROKE : 2);

  return (
    <IconComponent
      size={size}
      strokeWidth={sw}
      aria-hidden="true"
      {...props}
    />
  );
}

export { DUOTONE_OPACITY, OUTLINE_STROKE };
export type { IconProps, LucideIconName, IconVariant };
