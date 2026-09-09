import Image from "next/image";

const SIZES = {
  sm: 28,
  md: 36,
  lg: 56,
  xl: 96,
};

export default function Logo({
  size = "md",
  className = "",
}: {
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const px = SIZES[size];
  return (
    <Image
      src="/logo.jpeg"
      alt="Attendify.ai"
      width={px}
      height={px}
      priority
      className={`rounded-xl object-cover shrink-0 ${className}`}
      style={{ width: px, height: px }}
    />
  );
}
