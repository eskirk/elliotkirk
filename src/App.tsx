import React from "react";
import { Slackline } from "./components/Slackline";
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
              <i className="git-link fa fa-github fa-sm"></i>
            </a>
          </h1>
        </div>
      </div>

      <div className="row-break"></div>

      <div className="row align-items-center">
        <div className="col-sm ml-md-auto">
          <h4>
            full stack engineer @{" "}
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
      <Slackline />
    </div>
  );
};
