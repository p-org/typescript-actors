# TypeScript actors

**This is a research prototype.**

Libraries
for building and testing applications using
state machines and actors in TypeScript/JavaScript. 

## Getting started

Please see [Getting started](docs/getting_started.md) for
details of how to build the libraries and run some examples.

```bash
# State machines library
$ npm install state-machines
# Actors library
$ npm install async-actors
```

## Features overview

The libraries provide the following key features:

* TypeScript and JavaScript APIs for building applications using [state machines](packages/state-machines/) and [actors](packages/async-actors/).
* A testing runtime that uses systematic concurrency testing to control all
asynchrony and explore unexpected interleavings, exposing concurrency heisenbugs before release.

## State machines

See the [state machines README](packages/state-machines/README.md) for details.

```js
// A state machine in JavaScript that lists the files and 
// directories in the given input directory.

exports.SMLoadDirInfo = class {

  // The initial state.
  stateInit(input) {
    // Store the input (a path) to a field/property for later.
    this.directory = input[0];
    // Transition to (i.e. execute) `stateReaddir`.
    return this.sm.transitionTo(this.stateReaddir);
  }

  stateReaddir() {
    // Create another state machine that will get the files in 
    // `this.directory`.
    const m = this.sm.create(this.fs.readdir(), this.directory);
    // Execute the state machine and transition to `stateProcessReaddir` on 
    // success, or to `stateFailure` on failure.
    return this.sm.callTo(m, this.stateProcessReaddir, this.stateFailure);
  }

  stateProcessReaddir(files) {
    // Create several machines to get information on each file.
    const stats = files.map((f) => this.sm.create(this.fs.stat(), f));
    // Execute all the machines, transitioning to `stateProcessStats` once all
    // machines succeed, or to `stateFailure` as soon as *any* machine fails.
    return this.sm.callToAll(stats, this.stateProcessStats, this.stateFailure);
  }

  stateProcessStats(stats) {
    // Process the file information.
    util.processForDisplay(stats);
    // Complete this state machine with `stats` as the result.
    // The code that executed this machine will receive the result.
    return this.sm.completeWithSuccess(stats);
  }

  stateFailure(ex) {
    // Complete this state machine with an error.
    return this.sm.completeWithError(ex);
  }

};
```

## Typed and simple actors

See the [actors README](packages/async-actors/README.md) for details.

```ts
// A typed actor (uses interfaces and synchronous-style calls) in TypeScript 
// that lists the files and directories in the given input directory.

export class ServerImpl implements ServerActor {
  // File system actor.
  private fsActor: FSActor;
  /*...constructor omitted...*/
  public async loadDirectoryInfo(directory: string): Promise<Stat> {
    // List directory.
    const files = await this.fsActor.readdirAsync(directory);
    // Call stat on each file.
    const statPromises = files.map((f) => this.fsActor.statAsync(f));
    // Wait for all stat results, or first error.
    const stats = await Promise.all(asyncStats);
    // `stats` contains all the stats, or an exception was thrown.
    util.processForDisplay(stats);
    return stats;
  }
}
```

## Packages

This repository contains many npm packages within [packages/](packages/):

* [async-actors](packages/async-actors): 
The simple and typed actor APIs and runtimes, 
including the testing runtime.
* [async-actors-example](packages/async-actors-example): 
An example command line application 
that creates some actors using the different APIs.
* [rfs-demo](packages/rfs-demo): 
A file server that allows browsing 
the directory structure and viewing text files.
This represents a typical server-side Node application
written in TypeScript.
It does not use any actor or state machine libraries.
* [rfs-demo-actors](packages/rfs-demo-actors): 
A version of `rfs-demo` that uses typed actors.
It also includes a test harness
that uses the testing runtime to expose concurrency bugs
due to file renaming.
* [rfs-demo-state-machines](packages/rfs-demo-state-machines):
A version of `ref-demo` that uses state machines.
It also includes a test harness
that uses the testing runtime to expose concurrency bugs
due to file renaming.
* [state-machines](packages/state-machines):
The state machines API and runtime.
* [state-machines-example](packages/state-machines-example): 
An example of using state machines.
There is no test harness.
* [tsc-actors](packages/tsc-actors): 
An attempt at using the TypeScript compiler API
to generate classes for typed actors.
However, this is not currently used.

## FAQ

### I am getting errors about missing methods on `Promise`
We use the [Bluebird](http://bluebirdjs.com/) promise library
to replace the built-in `Promise` class.
Native `async` functions may cause issues as they will
return a native `Promise`.
To solve this, target `es2016` in your TypeScript compiler settings.

### How do I use the release runtime vs. the testing runtime?

For typed actors, see 
[app.ts](packages/rfs-demo-actors/src/app.ts)
vs.
[test.ts](packages/rfs-demo-actors/src/test.ts).

For state machines, see
[app.ts](packages/rfs-demo-state-machines/src/app.ts)
vs.
[test.ts](packages/rfs-demo-state-machines/src/test.ts).

