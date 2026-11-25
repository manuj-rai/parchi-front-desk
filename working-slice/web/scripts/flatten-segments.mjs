// After `next build`: give each page's navigation data the file name the browser asks for.
//
// For a page like /app/calls/, the static export writes   out/app/calls/__next.app/calls/__PAGE__.txt
// but client-side navigation requests                     out/app/calls/__next.app.calls.__PAGE__.txt
// (seen on Windows). Without the second name every click in the app is a 404 and a full page
// load instead of an instant switch. This copies each nested file to its dotted name; where the
// export already wrote dotted names, there is nothing to do.

import { copyFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const OUT = new URL("../out/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

function* files(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* files(path);
    else yield path;
  }
}

function* segmentFolders(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (!statSync(path).isDirectory()) continue;
    if (name.startsWith("__next.")) yield path;
    else if (name !== "_next") yield* segmentFolders(path);
  }
}

if (!existsSync(OUT)) {
  console.error("flatten-segments: no out/ folder; run next build first.");
  process.exit(1);
}

let copied = 0;
for (const folder of segmentFolders(OUT)) {
  for (const file of files(folder)) {
    const dotted = join(folder, "..", `${folder.split(sep).pop()}.${relative(folder, file).split(sep).join(".")}`);
    if (!existsSync(dotted)) {
      copyFileSync(file, dotted);
      copied += 1;
    }
  }
}
console.log(`flatten-segments: ${copied} navigation file${copied === 1 ? "" : "s"} given the name the browser asks for.`);
