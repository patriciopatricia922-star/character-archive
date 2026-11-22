// Display metadata for the soundtrack collection in /public/music.
//
// Tracks are discovered automatically from that folder (see src/app/api/music/route.ts), so adding
// an audio file there is enough for it to join the queue. Add an entry here to give it a proper
// title and composer credit; files without an entry fall back to a tidied-up filename and show no
// composer line.
//
// - `title` is matched against the file name ignoring case, spaces and punctuation, so
//   "Teller of the Tales.mp3" and "teller_of_the_tales.mp3" both match.
// - The order of this list is the playback order for known tracks. Unlisted files follow it
//   alphabetically.
export type TrackMeta = { title: string; composer?: string };

export const MUSIC_METADATA: TrackMeta[] = [
  { title: "Skye Cuillin", composer: "Kevin MacLeod" },
  { title: "Teller of the Tales", composer: "Kevin MacLeod" },
];

const AUDIO_EXTENSIONS = [".mp3", ".ogg", ".oga", ".m4a", ".aac", ".wav", ".opus", ".webm"];

const key = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

export type DiscoveredTrack = { src: string; title: string; composer?: string };

// Turns the file names found in /public/music into the playback queue: known tracks first (in the
// order of MUSIC_METADATA), everything else after them alphabetically.
export function buildTrackList(files: string[]): DiscoveredTrack[] {
  return files
    .filter((file) => AUDIO_EXTENSIONS.includes(file.slice(file.lastIndexOf(".")).toLowerCase()))
    .map((file) => {
      const stem = file.slice(0, file.lastIndexOf("."));
      const stemKey = key(stem);
      const metaIndex = MUSIC_METADATA.findIndex((meta) => stemKey.includes(key(meta.title)));
      const meta = metaIndex >= 0 ? MUSIC_METADATA[metaIndex] : undefined;
      return {
        order: metaIndex >= 0 ? metaIndex : Number.MAX_SAFE_INTEGER,
        file,
        src: `/music/${encodeURIComponent(file)}`,
        title: meta?.title ?? stem.replace(/_+/g, " ").replace(/\s+/g, " ").trim(),
        composer: meta?.composer,
      };
    })
    .sort((a, b) => a.order - b.order || a.file.localeCompare(b.file, undefined, { numeric: true }))
    .map(({ src, title, composer }) => ({ src, title, composer }));
}