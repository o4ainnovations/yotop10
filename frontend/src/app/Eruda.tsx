'use client';
import Script from "next/script";

export default function Eruda() {
  return (
    <Script
      src="//cdn.jsdelivr.net/npm/eruda"
      onLoad={() => {
        // @ts-expect-error Eruda types are not available
        window.eruda.init();
      }}
    />
  );
}
