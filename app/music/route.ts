import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { MUSIC_METADATA } from "../../data/musicTracks";

// Lists /public/music when the app is built (or on every request in `next dev`), so new audio
// files are picked up without touching the playback code.
export const dynamic = "force-static";

const AUDIO_EXTENSIONS = new Set([".mp3", ".ogg", ".oga", ".m4a", ".aac", ".wav", ".opus", ".webm"]);

const key = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

function tidyTitle(stem: string) {
  return stem.replace(/[_]+/g, " ").replace(/\s+/g, " ").trim();
}

export async function GET() {
  const directory = path.join(process.cwd(), "public", "music");

  let files: string[] = [];
  try {
    files = (await fs.readdir(directory, { withFileTypes: true }))
      .filter((entry) => entry.isFile() && AUDIO_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
      .map((entry) => entry.name);
  } catch {
    files = [];
  }

  const tracks = files
    .map((file) => {
      const stem = path.basename(file, path.extname(file));
      const stemKey = key(stem);
      const metaIndex = MUSIC_METADATA.findIndex((meta) => stemKey.includes(key(meta.title)));
      const meta = metaIndex >= 0 ? MUSIC_METADATA[metaIndex] : undefined;
      return {
        order: metaIndex >= 0 ? metaIndex : Number.MAX_SAFE_INTEGER,
        file,
        src: `/music/${encodeURIComponent(file)}`,
        title: meta?.title ?? tidyTitle(stem),
        composer: meta?.composer,
      };
    })
    .sort((a, b) => a.order - b.order || a.file.localeCompare(b.file, undefined, { numeric: true }))
    .map(({ src, title, composer }) => ({ src, title, composer }));

  return NextResponse.json(tracks);
}