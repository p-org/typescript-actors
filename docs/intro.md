
# The evolution of actor APIs


# Ordinary/simple actors

```ts
// To define an actor, you must implement this interface:
export interface Actor<T> {
  handle(msg: T): void;
}

// For example, the following actor receives strings and prints all of its messages:
class EchoActor implements Actor<string> {
  public handle(msg: string): void {
    console.log(msg);
  }
}

// Here is how we create two instances of this actor and send to them:
const runtime: ActorRuntime = new SimpleRuntime();
const actor1: ActorRef<string> = runtime.create("Actor1", new EchoActor());
const actor2: ActorRef<string> = runtime.create("Actor2", new EchoActor());
actor1.send("hello");
actor2.send("world");


// Note that the above actor refs only allow you to send strings (via generics). 
// Some of the types are shown explicitly, but they can be inferred. 
// The output will be:
hello
world
Or:
world
hello

// It may not be clear why the output is nondeterministic when running on Node; 
// the reason is the current simple actors runtime schedules actors somewhat randomly. 
// This is not necessarily adequate for thorough testing though, 
// as sends cannot be interleaved. 
// (Although, it is not clear whether we want sends to be interleaved 
// since this can’t occur on Node anyway.)
```

## File downloader example

```ts
// Let's define some classes that we can use as message types:
class GoalMsg {
  public files: string[];
}

class DownloadDoneMsg {
  public filename: string;
}

class QueryLocalFSResult {
  public localFiles: string[];
}

// And a type alias for the union type of all messages that our actor will receive:
type DMsg =
  GoalMsg
| DownloadDoneMsg
| QueryLocalFSResult;

// Now we can define our actor:
class FileDownloaderActor implements Actor<DMsg> {

  private goal: string[];
  private currentFiles: Set<string>;

  public handle(msg: DMsg) {

    if (msg instanceof GoalMsg) {
      this.goal = msg.files; 
    } else if (msg instanceof DownloadDoneMsg) {
      this.currentFiles.add(msg.filename); 
    } else {
      this.currentFiles = new Set(msg.localFiles);
    }
  }
}

// You will see:
// •	The actor has fields (state).
// •	The message type must be manually tested.
// What you can’t see easily is that TypeScript automatically narrows the
// type of `msg` within the different branches of the if statements.  
// An `ActorRef` for this actor only allows the sending of 
// `DMsg` messages.

```

# Interface actors (previously referred to as "typed actors")

```ts
// The interface actor runtime is implemented on top of 
// the ordinary actors runtime. 
// To define an interface actor, you must define its
// interface and at least one implementation:

export interface HelloActor {
  hello(s: string): void;
}

export class HelloActorImpl implements HelloActor {
  public hello(s: string) {
    console.log(s);
  }
}

// Note that actor methods must have a void return type.
// The `HelloActor` receives only `hello` messages, 
// which are composed of a string `s`. 
// The actor processes the `hello` message by printing `s`. 
// Note that, when implementing an actor, the usual features of the compiler 
// and IDE can be used. 
// E.g. missing handlers can be generated automatically; 
// a compile error is emitted if a handler is missing. 

// We can create a `HelloActor` and send to it using the returned proxy object:
const typedRuntime: TypedActorRuntime = new SimpleTypedActorRuntime(runtime);
const helloProxy: HelloActor = 
  typedRuntime.create<HelloActor>("HelloActor", new HelloActorImpl());
helloProxy.hello("typed hello...");
helloProxy.hello("typed world!");

// The "calls" to `hello` return immediately; 
// they actually send a message (using the simple actors described above). 
// The hello actor is a simple actor with a `handle` method that invokes
// the appropriate method of the `HelloActorImpl` instance. 
// But all of this is invisible to the user.
```
