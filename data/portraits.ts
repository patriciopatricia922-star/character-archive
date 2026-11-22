import caelPortrait from "../assets/Cael-Rendered.png";

export type PortraitData = { id: string; image?: string; alt?: string };

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