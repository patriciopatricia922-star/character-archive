// Portrait list. Add real artwork by setting `image` (e.g. "/portraits/01.jpg", placed in /public).
// No `image` = a placeholder silhouette is drawn. Names/lore are intentionally absent for Stage 1.
export type PortraitData = { id: string; image?: string; alt?: string };

export const portraits: PortraitData[] = [
  { id: "portrait-01" },
  { id: "portrait-02" },
  { id: "portrait-03" },
  { id: "portrait-04" },
  { id: "portrait-05" },
  { id: "portrait-06" },
  { id: "portrait-07" },
];