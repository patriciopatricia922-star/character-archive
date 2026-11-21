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