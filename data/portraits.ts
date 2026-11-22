import caelPortrait from "../assets/Cael-Rendered.png";

export type PortraitData = { id: string; image?: string; alt?: string };

export function placePortraitsCenterOutward(
  portraits: readonly PortraitData[],
): PortraitData[] {
  if (portraits.length <= 1) return [...portraits];

  const left: PortraitData[] = [];
  const right: PortraitData[] = [];

  for (let sourceIndex = 1; sourceIndex < portraits.length; sourceIndex += 1) {
    if (sourceIndex % 2 === 1) right.push(portraits[sourceIndex]);
    else left.unshift(portraits[sourceIndex]);
  }

  return [...left, portraits[0], ...right];
}

export const portraits: PortraitData[] = [
  {
    id: "portrait-01",
    image: caelPortrait.src,
    alt: "Portrait of Cael",
  },
  { id: "portrait-02" },
  { id: "portrait-03" },
  { id: "portrait-04" },
  { id: "portrait-05" },
  { id: "portrait-06" },
  { id: "portrait-07" },
];