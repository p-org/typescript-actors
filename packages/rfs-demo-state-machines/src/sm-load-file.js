// @ts-nocheck
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

const util = require("./util");

exports.SMLoadFile = class {

  stateInit(input) {
    this.path = input;
    return this.sm.transitionTo(this.stateLoadFile);
  }

  stateLoadFile() {
    const m = this.sm.create(this.fs.readfile(), [this.path, "utf8"]);
    return this.sm.callTo(m, this.stateProcessReadFile, this.stateFailure);
  }

  stateProcessReadFile(data) {
    const res = util.processFileLoadForDisplay(this.path, data);
    return this.sm.completeWithSuccess(res);
  }

  stateFailure(ex) {
    return this.sm.completeWithError(ex);
  }

};

