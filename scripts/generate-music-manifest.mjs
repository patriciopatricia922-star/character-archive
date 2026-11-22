// Writes public/music/manifest.json, the list of audio files the player turns into its queue.
// Run automatically before `dev` and `build` (see package.json), so adding a file to public/music
// is all that is needed for it to join the queue.
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const directory = path.join(root, "public", "music");
const extensions = new Set([".mp3", ".ogg", ".oga", ".m4a", ".aac", ".wav", ".opus", ".webm"]);

console.log(`Scanning ${directory}`);

let entries;
try {
  entries = await fs.readdir(directory, { withFileTypes: true });
} catch (error) {
  console.error(`Could not read ${directory}. Put your audio files in public/music (next to package.json).`);
  throw error;
}

const files = [];
for (const entry of entries) {
  if (entry.name === "manifest.json") continue;
  const extension = path.extname(entry.name).toLowerCase();
  if (entry.isDirectory()) {
    console.log(`  skipped  ${entry.name}  (a folder - files inside sub-folders are not scanned)`);
  } else if (!extensions.has(extension)) {
    console.log(`  skipped  ${entry.name}  (extension "${extension || "none"}" is not one of: ${[...extensions].join(" ")})`);
  } else {
    console.log(`  included ${entry.name}`);
    files.push(entry.name);
  }
}
files.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

await fs.writeFile(path.join(directory, "manifest.json"), JSON.stringify({ files }, null, 2) + "\n");
console.log(`Music manifest: ${files.length} track(s)`);