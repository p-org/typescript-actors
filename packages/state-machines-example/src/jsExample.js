// @ts-nocheck
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

// streams: keep this in mind. return this.sm.readFrom(stream, stateGot, stateTimeout);
// streams: could be message channels: union type. Maybe just one channel.

exports.mainMachine = {

  // `sm` is reserved

  input: undefined,

  stateInit: function(input) {
    this.sm.check(input > 0);
    this.input = input;
    return this.sm.transitionTo(this.stateDoComputation);
  },

  stateDoComputation: function() {
    const m = this.sm.create(exports.computeMachine, this.input);
    return this.sm.callTo(m, this.stateSuccess, this.stateError);
  },

  stateSuccess: function(n) {
    this.sm.check(n > 6, this.stateCheckFailed);
    return this.sm.completeWithSuccess(n);
  },

  stateError: function(reason) {
    return this.sm.completeWithError(reason);
  },

  stateCheckFailed: function() {
    console.log("Check failed state!");
    return this.sm.completeWithError("Check failed!");
  }
};


exports.computeMachine = {
  input: undefined,

  stateInit: function(input) {
    this.input = input;
    return this.sm.transitionTo(this.stateDoComputation);
  },

  stateDoComputation: function() {
    return this.sm.completeWithSuccess(this.input * 3);
  }

};

