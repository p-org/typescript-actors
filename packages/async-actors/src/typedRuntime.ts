
import { Receiver, ReceivingActor } from "./receive";
import { ReceivingActorImpl } from "./receiveImpl";
import { ActorRef, ActorRuntime } from "./simple";
import { TypedActorRuntime } from "./typed";

export class TypedActorRuntimeFactory {
  public static create(runtime: ActorRuntime): TypedActorRuntime {
    return new SimpleTypedActorRuntime(runtime);
  }
  private constructor() { }
}

// `ProxyMsg` does not really need to be exported, but it can be used to send a message
// to a typed actor (using send).
export class ProxyMsg {
  public constructor(
    public name: PropertyKey,
    public args: IArguments,
    public sender: ActorRef<any> | undefined,
    public returnVal: any,
    public ex: any,
  ) { }
}

class FakeActorRef implements ActorRef<ProxyMsg> {

  public readonly promise: Promise<ProxyMsg>;
  private resolveFunc: any;
  private sent: boolean;

  constructor() {
    this.promise = new Promise<ProxyMsg>((resolve) => { this.resolveFunc = resolve; });
    this.sent = false;
  }

  public send(msg: ProxyMsg): void {
    if (this.sent) { throw new Error("Return val was sent more than once!"); }
    this.sent = true;
    this.resolveFunc(msg);
  }

}

function maybeGetCurrActor(runtime: ActorRuntime): ActorRef<any> | undefined {
  // See if we can get the current actor:
  // tslint:disable-next-line:no-unnecessary-initializer
  let currActor: ActorRef<any> | undefined = undefined;
  try {
    currActor = runtime.currActor();
  } catch (_) {
    // Ignore.
  }
  return currActor;
}

function makeProxy(ref: ActorRef<any>, runtime: ActorRuntime) {
  return new Proxy({}, {
    get(_, name) {
      // tslint:disable-next-line:only-arrow-functions
      return function(): Promise<any> | undefined {

        // Simple case: send-and-forget; no return; no promise.
        if (name.toString().startsWith("send")) {
          ref.send(new ProxyMsg(name, arguments, undefined, undefined, undefined));
          return;
        }
        // Else:
        const currActor = runtime.isTesting() ? runtime.currActor() : maybeGetCurrActor(runtime);

        let proxyMsgPromise;

        if (!currActor) {
          const fakeActorRef = new FakeActorRef();
          const msg = new ProxyMsg(name, arguments, fakeActorRef, undefined, undefined);
          ref.send(msg);
          proxyMsgPromise = fakeActorRef.promise;
        } else {
          const msg = new ProxyMsg(name, arguments, currActor, undefined, undefined);
          ref.send(msg);
          const receiver: Receiver<ProxyMsg> =
            runtime.getCustomData(ReceivingActorImpl.RECEIVER_KEY) as Receiver<ProxyMsg>;
          proxyMsgPromise = receiver.receive<ProxyMsg>((m) => msg === m);
        }

        let resolveFunc: any;
        let rejectFunc: any;
        const resPromise = new Promise<any>((resolve, reject) => { resolveFunc = resolve; rejectFunc = reject; });

        proxyMsgPromise.then((m) => {
           if (m.ex) {
             rejectFunc(m.ex);
           } else {
             resolveFunc(m.returnVal);
           }
        });

        proxyMsgPromise.catch((ex) => {
          console.log("Typed runtime proxy internal error: " + ex);
          throw ex;
        });

        return resPromise;
      };
    },
  });
}

class TypedActorSimple implements ReceivingActor<ProxyMsg> {
  public constructor(public typedActorImpl: object) { }
  public async handle(msg: ProxyMsg, _: Receiver<ProxyMsg>): Promise<void> {
    if (!msg.sender) {
      await (this.typedActorImpl as any)[msg.name].apply(this.typedActorImpl, msg.args);
      return;
    }
    try {
      const p = (this.typedActorImpl as any)[msg.name].apply(this.typedActorImpl, msg.args);
      try {
        // The await might throw.
        const retValue = await p;
        msg.returnVal = retValue;
        msg.sender.send(msg);
      } catch (ex) {
        msg.ex = ex;
        msg.sender.send(msg);
      }
    } catch (ex) {
      console.error("Typed actor handler threw, which should never happen! Add async?", ex);
    }
  }
}

class SimpleTypedActorRuntime implements TypedActorRuntime {
  private runtime: ActorRuntime;

  constructor(runtime: ActorRuntime) {
    this.runtime = runtime;
  }

  public create<T>(name: string, typedActor: object, interleavedAwaits = false): T {
    const actorRef =
      this.runtime.create(
        name,
        new ReceivingActorImpl(new TypedActorSimple(typedActor), this.runtime, interleavedAwaits),
      );

    return makeProxy(actorRef, this.runtime) as any as T;
  }
}
