import Image from "next/image";

/** Logo de GES (busto en medallón dorado). */
export function Logo({ size = 40 }: { size?: number }) {
  return (
    <Image
      src="/logo-ges.png"
      alt="GES"
      width={size}
      height={size}
      priority
      className="shrink-0 rounded-full"
    />
  );
}
