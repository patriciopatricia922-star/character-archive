import caelPortrait from "../assets/Cael-Rendered.png";

export type PortraitData = { id: string; image?: string; alt?: string; primary?: boolean };

export const PRIMARY_PORTRAIT_ID = "portrait-04";

export const portraits: PortraitData[] = [
  {
    id: "portrait-01",
    image: caelPortrait.src,
    alt: "Portrait of Cael",
  },
  { id: "portrait-02" },
  { id: "portrait-03" },
  { id: "portrait-04", primary: true },
  { id: "portrait-05" },
  { id: "portrait-06" },
  { id: "portrait-07" },
];