import { Actor, ActorRef, ActorRuntime, ActorUtil,
  Receiver, ReceivingActor, ReceivingActorImpl,
  SimpleRuntimeFactory, TypedActorRuntime, TypedActorRuntimeFactory } from "async-actors";
import * as fs from "fs-extra-promise";

ActorUtil.defaultProductionSetup();

// Simple Actors - Hello World Example

class EchoActor implements Actor<string> {
  public handle(msg: string): void {
    console.log(msg);
  }
}

const runtime: ActorRuntime = SimpleRuntimeFactory.create();
const actor1: ActorRef<string> = runtime.create("Actor1", new EchoActor());
const actor2: ActorRef<string> = runtime.create("Actor2", new EchoActor());
actor1.send("hello");
actor2.send("world");











// Simple Actors - File downloader Example

class GoalMsg {
  public files: string[];
}

class DownloadDoneMsg {
  public filename: string;
}

class QueryLocalFSResult {
  public localFiles: string[];
}

type DMsg =
  GoalMsg
| DownloadDoneMsg
| QueryLocalFSResult;

class FileDownloaderSimpleActor implements Actor<DMsg> {

  private goal: string[];
  private currentFiles: Set<string>;

  public handle(msg: DMsg) {

    if (msg instanceof GoalMsg) {
      this.goal = msg.files; // type of `msg` is now GoalMsg
    } else if (msg instanceof DownloadDoneMsg) {
      this.currentFiles.add(msg.filename); // type of `msg` is now DownloadDoneMsg
    } else {
      this.currentFiles = new Set(msg.localFiles); // type of `msg` is now QueryLocalFSResult
    }
  }
}


const downloaderActor =
  runtime.create("FileDownloaderSimpleActor", new FileDownloaderSimpleActor());

downloaderActor.send(new GoalMsg());









// Typed Actors - Hello World Example

export interface HelloActor {
  hello(s: string): void;
}

export class HelloActorImpl implements HelloActor {
  public hello(s: string) {
    console.log(s);
  }
}

const typedRuntime: TypedActorRuntime = TypedActorRuntimeFactory.create(runtime);
const helloProxy: HelloActor = typedRuntime.create<HelloActor>("HelloActor", new HelloActorImpl());
helloProxy.hello("typed hello...");
helloProxy.hello("typed world!");





// Typed Actors - File Downloader Example

export interface FileDownloaderActor {
  sendUpdateGoal(files: string[]): void;
  sendDownloadDone(filename: string): void;
  sendQueryLocalFSResult(localFiles: string[]): void;
}


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


const downloaderProxy =
  typedRuntime.create<FileDownloaderActor>("FileDownloaderActor1", new FileDownloaderActorImpl());

downloaderProxy.sendUpdateGoal(["one.txt", "two.txt"]);
downloaderProxy.sendQueryLocalFSResult(["one.txt", "three.txt"]);



// Simple receiving actor

class PingMsg {
  constructor(public sender: ActorRef<PingMsg>) { }
}

class StartMsg {

}

class OtherMsg {

}

class ResponderActor implements Actor<PingMsg> {
  public handle(msg: PingMsg): void {
    msg.sender.send(msg);
  }

}

// tslint:disable-next-line:ban-types
type HraMsg = StartMsg | PingMsg | OtherMsg;

class HelloReceivingActor implements ReceivingActor<HraMsg> {

  constructor(public rt: ActorRuntime, public responderActor: ActorRef<PingMsg>) { }

  public async handle(msg: HraMsg, receiver: Receiver<HraMsg>): Promise<void> {
    if (msg instanceof StartMsg) {
      console.log("Sending ping message");
      this.responderActor.send(new PingMsg(this.rt.currActor<HraMsg>()));
      const p = receiver.receive((m) => m instanceof PingMsg);
      const m = await p;
      console.log("Received ping as expected! " + m);
    } else if (msg instanceof PingMsg) {
      console.log("Unexpected ping message!");
    } else if (msg instanceof OtherMsg) {
      console.log("OtherMsg");
    } else {
      console.log("Unexpected message TYPE!");
    }
  }

}

const responderRef = runtime.create("ResponderActor", new ResponderActor());
const receivingActorRef =
  runtime.create("HelloActor", new ReceivingActorImpl(new HelloReceivingActor(runtime, responderRef), runtime));

receivingActorRef.send(new StartMsg());

receivingActorRef.send(new OtherMsg());
receivingActorRef.send(new OtherMsg());
receivingActorRef.send(new OtherMsg());





// Typed actors (with async/await support, built using receiving actors)

interface A {
  sendGo(): void;
  sendOther(): void;
}

interface B {
  hello(): Promise<string>;
  bad(): Promise<string>;
  foo(): Promise<string[]>;
}

class AImpl implements A {
  constructor(public bProxy: B) { }

  public async sendGo(): Promise<void> {
    console.log("entered go...calling hello");
    const res1 = await this.bProxy.hello();
    console.log(`hello returned: ${res1} .. now calling bad.`);
    try {
      const res2 = await this.bProxy.bad();
      console.log(`UNEXPECTED: bad returned: ${res2}`);
    } catch (ex) {
      console.log(`bad threw: ${ex}`);
    } finally {
      console.log("exiting go");
    }
    console.log("calling foo");
    const res3 = await bProxy.foo();
    console.log(`foo returned: ${res3}`);
  }

  public async sendOther(): Promise<void> {
    console.log("other");
  }
}

class BImpl implements B {

    public async hello(): Promise<string> {
        console.log("Entered hello...exiting hello");
        return "hello_ret";
    }

    public async bad(): Promise<string> {
        console.log("Entered bad...now throwing...");
        // tslint:disable-next-line:no-string-throw
        throw "bad_ex";
    }

    public async foo(): Promise<string[]> {
      console.log("Entered foo...awaiting fs.readdir");
      const res = await fs.readdirAsync(".");
      console.log(`Got fs.readdir result ${res}...returning it.`);
      return res;
    }

}

const bProxy = typedRuntime.create<B>("B", new BImpl());
const aProxy = typedRuntime.create<A>("A", new AImpl(bProxy));

aProxy.sendGo();
aProxy.sendOther();












// Example of async/await and promises. (not actors)
declare function foo(): Promise<number>;
declare function bar(): Promise<number>;

export async function test(): Promise<number> {
  const p: Promise<number> = foo();
  const q: Promise<number> = bar();

  const a = await p;
  // ...
  const b = await q;
  // ...
  return a + b;
}

export async function testUnwrapped(): Promise<number> {
  const res: Promise<number> = new Promise((resolve) => {
    const p = foo();
    const q = bar();
    p.then((a) => { // will execute immediately if `p` is resovled (probably not)
      // ...
      q.then((b) => {
        // ...
        resolve(a + b);
      });
    });
  });
  return res;
}
