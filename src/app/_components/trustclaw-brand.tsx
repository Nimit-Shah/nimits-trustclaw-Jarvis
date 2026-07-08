"use client";

import Image from "next/image";
import Link from "next/link";

interface TrustClawBrandProps {
  size?: "sm" | "md" | "lg";
  logoLink?: string;
}

const SIZES = {
  sm: { logo: 22, text: "text-sm" },
  md: { logo: 28, text: "text-lg" },
  lg: { logo: 48, text: "text-2xl" },
} as const;

export function TrustClawBrand({ size = "md", logoLink }: TrustClawBrandProps) {
  const s = SIZES[size];

  const logo = (
    <Image
      src="/images/jarvis-logo.png"
      alt="Jarvis"
      width={s.logo}
      height={s.logo}
      className="rounded-sm object-contain"
      priority
    />
  );

  return (
    <div className="flex items-center gap-2">
      {logoLink ? <Link href={logoLink}>{logo}</Link> : logo}
      <span className={`${s.text} font-bold leading-tight tracking-tight text-foreground`}>
        Nimit&apos;s Jarvis
      </span>
    </div>
  );
}

