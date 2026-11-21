import { promises as fs } from "node:fs";
import path from "node:path";
import { cacheLife } from "next/cache";
import { NextResponse } from "next/server";
import { MUSIC_METADATA } from "../../data/musicTracks";

// Lists /public/music at build time, so new audio files are picked up on the next deploy without
// touching the playback code. (`dynamic = "force-static"` is not allowed with cacheComponents, so
// the listing is cached with "use cache" instead.)

const AUDIO_EXTENSIONS = new Set([".mp3", ".ogg", ".oga", ".m4a", ".aac", ".wav", ".opus", ".webm"]);

const key = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

function tidyTitle(stem: string) {
  return stem.replace(/[_]+/g, " ").replace(/\s+/g, " ").trim();
}

async function listTracks() {
  "use cache";
  // The file list only changes when a new build is deployed, so keep the build-time result.
  cacheLife({ stale: 3600, revalidate: 31536000, expire: 31536000 });

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

  return tracks;
}

export async function GET() {
  return NextResponse.json(await listTracks());
}