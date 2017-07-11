// @ts-nocheck
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

const path = require("path");
const fsStatemachines = require("./fs-statemachines");
const util = require("./util");

let elemId = 0;

exports.SMLoadDirInfo = class {

  stateInit(input) {
    this.rootDir = input[0];
    this.directory = input[1];
    this.fullpaths = undefined;
    return this.sm.transitionTo(this.stateReaddir);
  }

  stateReaddir() {
    const m = this.sm.create(this.fs.readdir(), this.directory);
    return this.sm.callTo(m, this.stateProcessReaddir, this.stateFailure);
  }

  stateProcessReaddir(files) {
    const filtered = files.filter((f) => util.withinPath(this.directory, f));
    this.fullpaths = filtered.map((f) => util.canonicalPath(this.directory, f));
    const stats = this.fullpaths.map((f) => this.sm.create(this.fs.stat(), f));

    return this.sm.callToAll(stats, this.stateProcessStats, this.stateFailure);
  }

  stateProcessStats(stats) {
    const withFullPaths = util.zip(this.fullpaths, stats);
    const justFilesAndDirs = withFullPaths.filter(([_, v]) => v.isFile() || v.isDirectory());
    const infos = justFilesAndDirs.map(([n, s]) => ({
      elemid: "_eid" + elemId++,
      encodedname: encodeURIComponent(n.substr(this.rootDir.length) + (s.isFile() ? "" : path.sep)),
      isfile: s.isFile(),
      shortname: path.basename(n) + (s.isFile() ? "" : path.sep),
    }));
    util.processForDisplay(infos);
    return this.sm.completeWithSuccess(infos);
  }

  stateFailure(ex) {
    return this.sm.completeWithError(ex);
  }

};

