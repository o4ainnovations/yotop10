'use client';
import Script from "next/script";

export default function Eruda() {
  if (process.env.NODE_ENV !== 'development') return null;

  return (
    <Script
      src="//cdn.jsdelivr.net/npm/eruda"
      onLoad={() => {
        // @ts-expect-error Eruda types are not available
        if (window.eruda) {
          // @ts-expect-error Eruda types are not available
          window.eruda.init();
        }
      }}
    />
  );
}
