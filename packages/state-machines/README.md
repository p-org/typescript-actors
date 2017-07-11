# State machines

**This is a research prototype.** Please see the [main GitHub page](https://github.com/p-org/typescript-actors).

A library for building and testing
applications using state machines
in TypeScript/JavaScript.

```bash
$ npm install state-machines
```

## Features

The library provide the following key features:

* TypeScript and JavaScript APIs for building applications using state machines.
* A testing runtime that uses systematic concurrency testing to control all
asynchrony and explore unexpected interleavings, exposing concurrency heisenbugs before release.

## State machines

The state machines API enables developers 
to elegantly express workflows that contain
asynchronous operations using state machines.
The "states" of a machine are just functions that are executed;
they return an object indicating what should happen next,
such as transitioning to another state.

For example, the following JavaScript state machine
lists the files and directories in the given input directory:

```js
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

## Testing

The library also supports thorough testing of different interleavings.
For example, the following TypeScript test harness aims to test what happens
when a file is renamed at the same time as executing the above
state machine:

```ts
// Renames `file.txt` to `file2.txt`.
const smRenamer = sm.create(new SMRenamer(/*...omitted...*/), undefined);
sm.executeAndForget(smRenamer);

// Read our (virtual) `test_directory`, which contains `file.txt`.
const o = new SMLoadDirInfo();
const smLoadDir = sm.create(o, ["test_directory"]);
const dir = await sm.execute(smLoadDir);
```

If the file is renamed 
between the calls to
`readdir` and `stat`, an error will occur.
This is very unlikely to happen
when running normally.
However, when using the testing runtime, 
the error is seen every time
because all possible interleavings are explored.

The state machine library is built on top of [typed actors](https://github.com/p-org/typescript-actors#typed-and-simple-actors).

## FAQ

Please see the [main GitHub page](https://github.com/p-org/typescript-actors)

