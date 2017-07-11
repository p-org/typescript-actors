# Async actors

**This is a research prototype.** Please see the [main GitHub page](https://github.com/p-org/typescript-actors).

A library for building and testing
applications using actors
in TypeScript/JavaScript.

```bash
$ npm install async-actors
```

## Features

The library provide the following key features:

* TypeScript and JavaScript APIs for building applications using typed actors and simple actors.
* A testing runtime that uses systematic concurrency testing to control all
asynchrony and explore unexpected interleavings, exposing concurrency heisenbugs before release.

The library only provides messaging
between actors within the same process;
interprocess messaging must be handled by the developer.

## Typed actors

The [typed actors API](src/typed.ts) 
enables developers to write actors using interfaces.
Each actor has a FIFO queue of messages to handle;
each message will be 
handled by the actor sequentially (one-after-the-other).
When handling a message,
an actor can create other actors and/or send messages
to other actors and/or update its own state (i.e. its fields).

For example, in TypeScript:

```ts
// A file downloader actor that will be given a "goal"
// (a list of files to download).
export interface FileDownloaderActor {
  sendUpdateGoal(files: string[]): void;
  sendDownloadDone(filename: string): void;
  sendQueryLocalFSResult(localFiles: string[]): void;
}
```

Each method of the interface is a message type that it can handle.
We can implement the interface/actor to define how the messages
will be handled:

```ts
export class FileDownloaderActorImpl implements FileDownloaderActor {
  private goal: string[];
  private currentFiles: Set<string>;

  public sendUpdateGoal(files: string[]): void {
    this.goal = files;
    // TODO: Send message to query local FS.
  }

  public sendDownloadDone(_: string): void {
    // TODO: Send message to query local FS.
  }

  public sendQueryLocalFSResult(localFiles: string[]): void {
    this.currentFiles = new Set(localFiles);
    this.resolve();
  }

  private resolve() {
    // TODO: Download missing files.
  }
}
```

We can create this actor and send it various messages:

```ts
// Create the actor and get a reference to it.
const actorRef =
  typedRuntime.create<FileDownloaderActor>(new FileDownloaderActorImpl());

// These "method calls" actually just send a message to the actor.
// The messages will be handled by the file downloader actor 
// at some point in the future.
// The "method calls" return immediately, 
// regardless of whether the message has been handled yet.
actorRef.sendUpdateGoal(["one.txt", "two.txt"]);
actorRef.sendQueryLocalFSResult(["one.txt", "three.txt"]);
```

Notice that the methods all have a `void` return type,
as they correspond to sending messages that will be processed
asynchronously.
The API also supports synchronous-style messages using `async` and `await`.
For example, consider a file system actor:

```ts
// A file system actor that can query the file system.
export interface FileSystemActor {
  listFiles(path: string): Promise<string[]>;
  getFileContents(file: string): Promise<string>;
}
```

We can send a `listFiles` message and wait for the result
(just like a normal method call):

```ts
// Create the actor and get a reference to it.
const actorRef =
  typedRuntime.create<FileSystemActor>(/*...omitted...*/);

const files: string[] = await actorRef.listFiles(".");
// Do something with files. E.g.
const contents: string = await actorRef.getFileContents(files[0]);
```

Synchronous-style methods are those that do not start with "send"
(e.g. `listFiles` vs. `sendUpdateGoal`) and
must have a `Promise<...>` return type.
Exceptions are also propagated.

Although these look like normal `async` method calls,
the continuation (the execution state after an `await`)
is always executed/continued in the context of the calling actor
and other messages cannot be handled by the actor in the meantime 
(although this behaviour can be changed via an option).
This unfortunately means that deadlock is possible
via a cyclic chain of calls.

The typed actors API is built on top of the simple actors API.


## Simple actors

The [simple actors API](src/simple.ts)
enables developers to write more traditional, simple actors 
by implementing the `Actor` interface:

```ts
export interface Actor<T> {
  handle(msg: T): void;
}
```

For example:

```ts
// Define a union type of all messages we want to handle.
type DMsg =
  GoalMsg
| DownloadDoneMsg
| QueryLocalFSResult;


// Define a file downloader actor, similar to earlier.
class FileDownloaderSimpleActor implements Actor<DMsg> {

  private goal: string[];
  private currentFiles: Set<string>;

  public handle(msg: DMsg) {

    if (msg instanceof GoalMsg) {
      this.goal = msg.files; 
      // ...
    } else if (msg instanceof DownloadDoneMsg) {
      this.currentFiles.add(msg.filename); 
      // ...
    } else {
      this.currentFiles = new Set(msg.localFiles);
      // ...
    }
  }
}
```

Notice that, due to type narrowing,
the TypeScript compiler (and autocomplete tooling)
narrows the type of `msg` within the if/else blocks.

Here is how we create the actor and send messages to it:

```ts
const downloaderActor =
  runtime.create("FileDownloaderSimpleActor", new FileDownloaderSimpleActor());

downloaderActor.send(new GoalMsg(["1.txt", "2.txt"]));
```

The testing runtime is implemented at the level of simple actors;
testing of typed actors comes for free.

## Testing

The library also supports thorough testing of different interleavings
via the testing runtime.
For example, the following TypeScript test harness aims to test what happens
when a file is renamed at the same time as a file server actor tries to list the
files in a directory:

```ts
class TestRenaming implements Harness {
  public async main(/* ...omitted... */): Promise<void> {
    
    /* ... */
    
    // Server actor that can list the files in a directory.
    const serverActor =
      typedRuntime.create(/*...*/);
    
    // Renamer actor that renames `test.txt` to `test1.txt`.
    const renamerActor = 
      typedRuntime.create(/*...*/);
    
    // Rename the file at some point in the future.
    renamerActor.sendGo();

    // List the (virtual) directory `testdata`
    const dir = await fsServerActor.loadDirectoryInfo("testdata");
    
  }
}
```

The file server first obtains a list of files
and then queries information about each file
before returning the result.
If the file is renamed 
between the list and query then an error will occur.
This is very unlikely to happen
when running normally.
However, when using the testing runtime, 
the error is seen every time
because all possible interleavings are explored.

See [test.ts](packages/rfs-demo-actors/src/test.ts)
for the full test harness.

## FAQ

Please see the [main GitHub page](https://github.com/p-org/typescript-actors)
