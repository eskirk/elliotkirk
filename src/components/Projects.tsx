import React, { useEffect, useState } from "react";

// Mirror of the public GitHub pins, populated entirely at runtime: the six
// repo names are the only datum the anonymous API can't provide (GitHub
// exposes "which repos are pinned" only to authenticated GraphQL), so they
// live here as a plain list; everything else — including the card ORDER
// (newest star count first), descriptions, languages and last-push dates —
// comes live from api.github.com (CORS-open, no token, 60 req/hr per
// visitor IP: six requests per page visit).

interface Repo {
  fullName: string;
  name: string;
  url: string;
  desc: string;
  lang: string;
  stars: number;
  fork: boolean;
  pushedAt: string;
}

const PINNED_REPOS = [
  "grafana/faro-web-sdk",
  "grafana/faro-javascript-bundler-plugins",
  "grafana/clusterurl",
  "eskirk/GeneticAlgorithmPong",
  "eskirk/population-sim",
  "eskirk/pi-interactive-orca-subagents",
];

// GitHub's own linguist colors for the languages in the pin set, with a
// neutral fallback for anything added later.
const LANG_COLORS: Record<string, string> = {
  TypeScript: "#3178c6",
  JavaScript: "#f1e05a",
  Go: "#00add8",
  Python: "#3572a5",
  Rust: "#dea584",
  CSS: "#563d7c",
  HTML: "#e34c26",
  Shell: "#89e051",
};

function langColor(lang: string): string {
  return LANG_COLORS[lang] || "#8b949e";
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (isNaN(then)) return "";
  const secs = Math.max(0, (Date.now() - then) / 1000);
  if (secs < 45) return "just now";
  const mins = secs / 60;
  if (mins < 60) return `${Math.max(1, Math.round(mins))}m ago`;
  const hours = mins / 60;
  if (hours < 24) return `${Math.round(hours)}h ago`;
  const days = hours / 24;
  if (days < 2) return "yesterday";
  if (days < 31) return `${Math.round(days)}d ago`;
  const d = new Date(then);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString("en-US", {
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
    ...(sameYear ? { day: "numeric" } : {}),
  });
}

function fmtStars(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k` : String(n);
}

const Card = ({ r }: { r: Repo }) => (
  <a className="repo-card" href={r.url} target="_blank" rel="noreferrer">
    <div className="repo-top">
      <span className="repo-disc" style={{ background: langColor(r.lang) }} />
      <span className="repo-name">{r.name}</span>
      {r.fork && <span className="repo-fork">fork</span>}
    </div>
    <div className="repo-desc">{r.desc}</div>
    <div className="repo-meta">
      {r.lang && (
        <span className="repo-lang">
          <span className="repo-dot" style={{ background: langColor(r.lang) }} />
          {r.lang}
        </span>
      )}
      <span className="repo-stars">
        ★ <b>{fmtStars(r.stars)}</b>
      </span>
      <span className="repo-updated">{relativeTime(r.pushedAt)}</span>
    </div>
  </a>
);

export const Projects = () => {
  const [repos, setRepos] = useState<Repo[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled(
      PINNED_REPOS.map((fullName) =>
        fetch(`https://api.github.com/repos/${fullName}`, {
          headers: { Accept: "application/vnd.github+json" },
        }).then((r) => {
          if (!r.ok) throw new Error(`${fullName}: ${r.status}`);
          return r.json() as Promise<Record<string, unknown>>;
        })
      )
    ).then((results) => {
      if (cancelled) return;
      const loaded: Repo[] = [];
      results.forEach((res, i) => {
        if (res.status !== "fulfilled") return;
        const fullName = PINNED_REPOS[i];
        const d = res.value;
        loaded.push({
          fullName,
          name: String(d.name ?? fullName.split("/")[1]),
          url: String(d.html_url ?? `https://github.com/${fullName}`),
          desc: String(d.description ?? ""),
          lang: String(d.language ?? ""),
          stars: Number(d.stargazers_count ?? 0),
          fork: Boolean(d.fork),
          pushedAt: String(d.pushed_at ?? ""),
        });
      });
      if (loaded.length === 0) {
        setFailed(true);
      } else {
        // Newest-first by stars — the order the cards appear in.
        loaded.sort((a, b) => b.stars - a.stars);
        setRepos(loaded);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="projects">
      <h1 className="projects-title">projects</h1>
      {failed ? (
        <div className="repo-empty">
          Couldn’t reach GitHub right now — reload to try again.
        </div>
      ) : (
        <div className="repo-grid">
          {repos
            ? repos.map((r) => <Card key={r.fullName} r={r} />)
            : PINNED_REPOS.map((fullName) => (
                <div
                  className="repo-card repo-skel"
                  key={fullName}
                  aria-hidden="true"
                >
                  <div className="skel skel-top" />
                  <div className="skel skel-line" />
                  <div className="skel skel-line short" />
                  <div className="skel skel-meta" />
                </div>
              ))}
        </div>
      )}
    </div>
  );
};
