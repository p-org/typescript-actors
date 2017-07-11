
import { Actor, ActorRef, ActorRuntime } from "./simple";


export class SimpleRuntimeFactory {
  public static create(): ActorRuntime {
    return new SimpleRuntime();
  }
  private constructor() { }
}

class ActorInfo {
  public readonly name: string;
  public readonly handler: Actor<any>;
  public readonly mailbox: any[];
  public readonly customData: Map<string, any>;

  public ref: ActorRefImpl<any>;

  constructor(name: string, handler: Actor<any>) {
    this.name = name;
    this.handler = handler;
    this.mailbox = new Array<any>();
    this.customData = new Map();
  }
}

class ActorRefImpl<T> implements ActorRef<T> {
  public readonly actorInfo: ActorInfo;
  public readonly actorRuntime: SimpleRuntime;

  constructor(actorInfo: ActorInfo, actorRuntime: SimpleRuntime) {
    this.actorInfo = actorInfo;
    this.actorRuntime = actorRuntime;
  }

  public send(msg: T): void {
    this.actorInfo.mailbox.push(msg);
    this.actorRuntime.addActiveActor(this.actorInfo);
  }
}

interface Random {
  getNext(upToExcluding: number): number;
}

class MyRandom implements Random {
  public getNext(max: number): number {
    if (max === 0) {
      throw new Error("Passed 0 to getNext random int.");
    }
    max = Math.floor(max);
    return Math.floor(Math.random() * max);
  }
}

class SimpleRuntime implements ActorRuntime {
  private currActorInfo?: ActorInfo;
  private activeActors = new Set<ActorInfo>();
  private rand: Random = new MyRandom();

  public create<T>(name: string, actor: Actor<T>): ActorRef<T> {
    const actorInfo = new ActorInfo(name, actor);
    const ref = new ActorRefImpl(actorInfo, this);
    actorInfo.ref = ref;
    return ref;
  }

  public currActor<T>(): ActorRef<T> {
    if (!this.currActorInfo) {
      throw new Error("Could not get current actor ref!");
    }
    return this.currActorInfo.ref;
  }

  public getCustomData<T>(key: string): T {
    if (!this.currActorInfo) {
      throw new Error("Could not get current actor ref!");
    }
    return this.currActorInfo.customData.get(key) as T;
  }

  public setCustomData<T>(key: string, val: T): void {
    if (!this.currActorInfo) {
      throw new Error("Could not get current actor ref!");
    }
    this.currActorInfo.customData.set(key, val);
  }

  public isTesting(): boolean {
    return false;
  }

  public addActiveActor(actorInfo: ActorInfo) {
    if (this.activeActors.size === 0) {
      this.setTimeout();
    }
    this.activeActors.add(actorInfo);
  }

  public handleMsgLoop(): void {
    const actorList = Array.from(this.activeActors);
    const i = this.rand.getNext(actorList.length);
    const actor = actorList[i];
    this.handleOneMsgForActor(actor);
    if (actor.mailbox.length === 0) {
      this.activeActors.delete(actor);
      if (this.activeActors.size === 0) {
        // exit loop
        return;
      }
    }
    this.setTimeout();
  }

  public handleOneMsgForActor(actorInfo: ActorInfo) {
    const msg = actorInfo.mailbox.shift();
    this.currActorInfo = actorInfo;
    actorInfo.handler.handle(msg);
    this.currActorInfo = undefined;
  }

  private setTimeout(): void {
    setImmediate(this.handleMsgLoop.bind(this));
  }

}
