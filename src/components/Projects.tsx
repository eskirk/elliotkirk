import React, { useEffect, useState } from "react";
import snapshot from "../projects.json";

// Mirror of the public GitHub pins (src/projects.json is the committed
// snapshot of their order + metadata). The API never exposes *which* repos
// are pinned to anonymous callers, so the pin list itself is the snapshot;
// each card then hydrates live from the public REST API (no token, CORS-open,
// 60 req/hr per visitor IP — six requests per page visit). Any failed fetch
// just leaves the snapshot values on screen.

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

interface ApiRepo {
  name?: string;
  html_url?: string;
  description?: string | null;
  language?: string | null;
  stargazers_count?: number;
  fork?: boolean;
  pushed_at?: string;
}

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

const initial: Repo[] = snapshot as Repo[];

export const Projects = () => {
  const [repos, setRepos] = useState<Repo[]>(initial);

  useEffect(() => {
    let cancelled = false;
    initial.forEach((base, i) => {
      fetch(`https://api.github.com/repos/${base.fullName}`, {
        headers: { Accept: "application/vnd.github+json" },
      })
        .then((r) => (r.ok ? (r.json() as Promise<ApiRepo>) : null))
        .then((d) => {
          if (!cancelled && d) {
            setRepos((prev) => {
              const next = [...prev];
              const cur = next[i] as Repo;
              next[i] = {
                ...cur,
                name: d.name ?? cur.name,
                url: d.html_url ?? cur.url,
                desc: d.description ?? cur.desc,
                lang: d.language ?? cur.lang,
                stars: d.stargazers_count ?? cur.stars,
                fork: d.fork ?? cur.fork,
                pushedAt: d.pushed_at ?? cur.pushedAt,
              };
              return next;
            });
          }
        })
        .catch(() => {
          /* snapshot values stay */
        });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="projects">
      <h1 className="projects-title">projects</h1>
      <div className="repo-grid">
        {repos.map((r) => (
          <a
            className="repo-card"
            key={r.fullName}
            href={r.url}
            target="_blank"
            rel="noreferrer"
          >
            <div className="repo-top">
              <span
                className="repo-disc"
                style={{ background: langColor(r.lang) }}
              />
              <span className="repo-name">{r.name}</span>
              {r.fork && <span className="repo-fork">fork</span>}
            </div>
            <div className="repo-desc">{r.desc}</div>
            <div className="repo-meta">
              {r.lang && (
                <span className="repo-lang">
                  <span
                    className="repo-dot"
                    style={{ background: langColor(r.lang) }}
                  />
                  {r.lang}
                </span>
              )}
              <span className="repo-stars">
                ★ <b>{fmtStars(r.stars)}</b>
              </span>
              <span className="repo-updated">{relativeTime(r.pushedAt)}</span>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
};
