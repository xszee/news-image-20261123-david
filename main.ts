// news-image-20261123 entry: copies the pre-drawn front page to the output dir.
// Node 22, standard library only. No network. Deterministic: byte-identical output.
import { copyFileSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
const entryName = "entry.png";

function fail(message: string): never {
  console.error(`error: ${message}`);
  process.exit(1);
}

// The image lives beside this file in the repository.
const here = fileURLToPath(new URL(".", import.meta.url));
const source = join(here, "art.png");

let bytes: Buffer;
try {
  bytes = readFileSync(source);
} catch {
  fail(`cannot read ${source}`);
}

// Guard 1: PNG magic bytes.
import { createHash } from "node:crypto";
const pngMagic = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
if (!bytes.subarray(0, 8).equals(pngMagic)) {
  fail("art.png is not a PNG file");
}

// Guard 2: the first chunk must be IHDR (length at 8, type at 12).
if (bytes.toString("latin1", 12, 16) !== "IHDR") {
  fail("art.png does not start with an IHDR chunk");
}

// Guard 3: size limit of 1 MiB.
const maxBytes = 1048576;
if (bytes.length > maxBytes) {
  fail(`art.png is ${bytes.length} bytes, over the 1 MiB limit`);
}

// Guard 4: dimensions must be 1024 x 1024 (IHDR width/height, big-endian).
const width = bytes.readUInt32BE(16);
const height = bytes.readUInt32BE(20);
if (width !== 1024 || height !== 1024) {
  fail(`art.png is ${width}x${height}, expected 1024x1024`);
}

mkdirSync(outDir, { recursive: true });
const dest = join(outDir, entryName);
copyFileSync(source, dest);

const written = statSync(dest).size;
if (written !== bytes.length) {
  fail(`wrote ${written} bytes, expected ${bytes.length}`);
}
const digest = createHash("sha256").update(bytes).digest("hex");
console.log(`wrote ${dest} (${written} bytes, ${width}x${height} PNG, sha256 ${digest})`);
