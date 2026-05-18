// Displays a procedural identity avatar (SVG data URI). The img approach
// lets the browser cache the data URI like any other image.
export function AvatarSvg({
  src,
  size = 96,
  className = "",
  alt = "",
}: {
  src: string;
  size?: number;
  className?: string;
  alt?: string;
}) {
  return (
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      className={`rounded-full shadow-2xl ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
