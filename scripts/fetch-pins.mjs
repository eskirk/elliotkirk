// Build-time pin snapshot: fetches the pinned repos' current metadata from the
// public GitHub API and writes src/pins-generated.json, which the Projects
// component imports so the page paints cards instantly (and works even with
// the API blocked). The browser then re-fetches live on top of this.
//
// Runs as `prebuild` (also on the VPS during deploy). If GitHub is
// unreachable at build time, the previous generated file (persisted from an
// earlier build) is reused; if there is none, an empty array is written and
// the page falls back to runtime fetching only. Never fails the build.
import { writeFile, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const REPOS = [
  "grafana/faro-web-sdk",
  "grafana/faro-javascript-bundler-plugins",
  "grafana/clusterurl",
  "eskirk/GeneticAlgorithmPong",
  "eskirk/population-sim",
  "eskirk/pi-interactive-orca-subagents",
];

const OUT = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "src",
  "pins-generated.json"
);

function toSnap(fullName, d) {
  return {
    fullName,
    name: d.name ?? fullName.split("/")[1],
    url: d.html_url ?? `https://github.com/${fullName}`,
    desc: d.description ?? "",
    lang: d.language ?? "",
    stars: d.stargazers_count ?? 0,
    fork: Boolean(d.fork),
    pushedAt: d.pushed_at ?? "",
  };
}

let snapshot = null;
try {
  const results = await Promise.allSettled(
    REPOS.map((fullName) =>
      fetch(`https://api.github.com/repos/${fullName}`, {
        headers: {
          Accept: "application/vnd.github+json",
          "User-Agent": "elliotkirk-build",
        },
        signal: AbortSignal.timeout(10000),
      }).then(async (r) => {
        if (!r.ok) throw new Error(`${fullName}: HTTP ${r.status}`);
        return toSnap(fullName, await r.json());
      })
    )
  );
  const ok = results
    .filter((r) => r.status === "fulfilled")
    .map((r) => r.value)
    .sort((a, b) => b.stars - a.stars);
  if (ok.length > 0) {
    snapshot = ok;
    console.log(`[fetch-pins] wrote ${ok.length}/${REPOS.length} repos`);
  } else {
    console.warn("[fetch-pins] GitHub unreachable at build time");
  }
} catch (err) {
  console.warn("[fetch-pins] build-time fetch failed:", err?.message ?? err);
}

if (!snapshot) {
  try {
    snapshot = JSON.parse(await readFile(OUT, "utf8"));
    console.log("[fetch-pins] reusing previous snapshot");
  } catch {
    snapshot = [];
    console.warn("[fetch-pins] no previous snapshot; runtime fetch is fallback");
  }
}

await writeFile(OUT, JSON.stringify(snapshot, null, 2) + "\n");
