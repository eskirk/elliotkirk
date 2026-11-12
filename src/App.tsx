import React, { useEffect, useState } from "react";
import { Balls } from "./components/Balls";
import { Projects } from "./components/Projects";
import "./style.scss";

// Set the header's foreground + link colors to contrast the page's *actual*
// background, so the text stays legible whether the OS renders the page in
// light or "smart" dark mode (e.g. iOS). We only adapt the text — the
// background itself is left untouched.
function applyContrast() {
  const match = getComputedStyle(document.body).backgroundColor.match(/rgba?\(([^)]+)\)/);
  // Treat an unreadable/transparent background as a light page.
  let lum = 1;
  if (match) {
    const parts = match[1].split(",").map((v) => parseFloat(v));
    const r = parts[0] ?? 0;
    const g = parts[1] ?? 0;
    const b = parts[2] ?? 0;
    const alpha = parts.length >= 4 ? parts[3] ?? 1 : 1;
    if (alpha >= 0.5) {
      lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    }
  }
  const dark = lum < 0.5;
  const root = document.documentElement;
  root.style.setProperty("--fg", dark ? "#ffffff" : "#212529");
  root.style.setProperty("--accent-1", dark ? "#d9b3ff" : "rgb(189, 151, 221)");
  root.style.setProperty("--accent-2", dark ? "#ff8f6b" : "rgb(220, 95, 65)");
}

// Tiny dependency-free hash router: "#/projects" shows the projects page,
// anything else shows the ball scene. The canvas stays mounted across
// routes, so the physics (and tilt/rain on mobile) is continuous.
function useHashRoute(): string {
  const [hash, setHash] = useState<string>(() => window.location.hash);
  useEffect(() => {
    const onHash = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  return hash;
}

const HOME_TITLE = "Elliot Kirk — Software Engineer";

export const App = () => {
  const route = useHashRoute();
  const onProjects = route.startsWith("#/projects");

  useEffect(() => {
    applyContrast();
    // Re-evaluate when the OS flips between light and dark.
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyContrast();
    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", onChange);
    } else {
      (mq as any).addListener(onChange); // older Safari
    }
    // iOS applies dark-mode overrides asynchronously; re-check shortly after load.
    const t = window.setTimeout(applyContrast, 400);
    return () => {
      if (typeof mq.removeEventListener === "function") {
        mq.removeEventListener("change", onChange);
      } else {
        (mq as any).removeListener(onChange);
      }
      window.clearTimeout(t);
    };
  }, []);

  // Projects scrolls (it's taller than the viewport); home stays pinned.
  useEffect(() => {
    document.title = onProjects ? `Projects — ${HOME_TITLE}` : HOME_TITLE;
    window.scrollTo(0, 0);
  }, [onProjects]);

  return (
    <div className={`page-shell${onProjects ? " page-shell--scroll" : ""}`}>
      <div className="top-content container">
      <div className="name row align-items-horizontal">
        <div className="col-md-12">
          <h1>
            elliot kirk
            <a
              href="https://github.com/eskirk"
              target="_blank"
              rel="noreferrer"
            >
              <i className="git-link fa-brands fa-github fa-sm"></i>
            </a>
          </h1>
          <nav className="site-nav">
            <a href="#/" className={onProjects ? undefined : "active"}>
              home
            </a>
            <a href="#/projects" className={onProjects ? "active" : undefined}>
              projects
            </a>
          </nav>
        </div>
      </div>

      <div className="row-break"></div>

      {onProjects ? (
        <Projects />
      ) : (
        <>
          <div className="row align-items-center">
            <div className="col-sm ml-md-auto">
              <h4>
                software engineer @{" "}
                <a
                  className="job-link"
                  href="https://grafana.com/"
                  target="_blank"
                  rel="noreferrer"
                >
                  grafana labs
                </a>
              </h4>
            </div>
          </div>
        </>
      )}
      {/* The ball scene is home-only: projects is a clean white page, and
          physics/tilt/rain fully stop (component unmounts) while it's open. */}
      {!onProjects && <Balls />}
      {!onProjects && (
        <div className="shortcuts">
          <span><kbd>a</kbd> add a ball</span>
          <span><kbd>c</kbd> clear</span>
          <span><kbd>g</kbd> toggle ground</span>
          <span><kbd>e</kbd> toggle gravity</span>
          <span><kbd>r</kbd> reset</span>
        </div>
      )}
      </div>
    </div>
  );
};
