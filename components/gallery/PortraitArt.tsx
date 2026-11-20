import type { PortraitData } from "../../data/portraits";

type Props = { data: PortraitData; seed: number };

// Renders real artwork if provided, otherwise a painted-style placeholder silhouette.
export default function PortraitArt({ data, seed }: Props) {
  if (data.image) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={data.image} alt={data.alt ?? ""} loading="lazy" decoding="async" draggable={false} className="pf-art" />;
  }
  const hue = 22 + (seed % 5) * 6;
  const light = 20 + (seed % 3) * 3;
  const head = 17 + (seed % 3) * 2;
  return (
    <svg viewBox="0 0 100 133" className="pf-art" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
      <rect width="100" height="133" fill={`hsl(${hue} 32% ${light}%)`} />
      <circle cx="50" cy="56" r={head} fill="#1c120b" />
      <path d="M12 133 Q16 88 50 82 Q84 88 88 133Z" fill="#1c120b" />
    </svg>
  );
}