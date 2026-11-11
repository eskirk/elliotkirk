import React from "react";
import { Balls } from "./components/Balls";
import "./style.scss";

export const App = () => {
  return (
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
        </div>
      </div>

      <div className="row-break"></div>

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
      <div className="row align-items-center">
        <div className="col-sm ml-md-auto">
          <h4>more to come</h4>
        </div>
      </div>
      <Balls />
      <div className="shortcuts">
        <span><kbd>a</kbd> add a ball</span>
        <span><kbd>c</kbd> clear</span>
        <span><kbd>g</kbd> toggle ground</span>
        <span><kbd>e</kbd> toggle gravity</span>
        <span><kbd>r</kbd> reset</span>
      </div>
    </div>
  );
};
