
import * as assert from "assert";
import { Logger } from "./logger";
import { SimpleLogger } from "./loggerImpl";
import { Actor, ActorRef, TestingRuntime } from "./simple";
import { Op, OpType, SchedulingStrategy, Thread } from "./strategies/strategy";

export class TestingRuntimeFactory {
  public static create(logger: Logger = new SimpleLogger()): TestingRuntime {
    return new SimpleTestingRuntime(logger);
  }
  private constructor() { }
}


class OpImpl implements Op {
  constructor(
    public type: OpType,
    public target: ActorInfo,
    public val?: any,
  ) { }
}

class ActorInfo implements Thread {
  public readonly name: string;
  public readonly handler: Actor<any>;
  public readonly mailbox: any[];
  public readonly customData: Map<string, any>;
  public ref: ActorRefImpl<any>;

  // When testing, we may want to conceptually preempt actors before a send, create, etc.
  // This can be useful in modeling inter-process communication.
  // To do this, we buffer the operations.
  public readonly bufferedOps: OpImpl[];
  public enabled: boolean;
  public terminated: boolean;

  public nextOp: OpImpl;

  constructor(name: string, handler: Actor<any>) {
    this.name = name;
    this.handler = handler;
    this.mailbox = new Array<any>();
    this.customData = new Map();
    this.bufferedOps = new Array<OpImpl>(new OpImpl(OpType.Start, this));
    this.enabled = false;
    this.terminated = false;
  }
}

class ActorRefImpl<T> implements ActorRef<T> {
  public readonly actorInfo: ActorInfo;
  public readonly actorRuntime: SimpleTestingRuntime;

  constructor(actorInfo: ActorInfo, actorRuntime: SimpleTestingRuntime) {
    this.actorInfo = actorInfo;
    this.actorRuntime = actorRuntime;
  }

  public send(msg: T): void {
    this
      .actorRuntime
      .getCurrActorInfo()
      .bufferedOps
      .push(new OpImpl(OpType.Send, this.actorInfo, msg));
  }
}


class SimpleTestingRuntime implements TestingRuntime {
  private currActorInfo?: ActorInfo;
  private readonly actors = new Array<ActorInfo>();
  private failed: boolean;
  private failure: any;
  private logger: Logger;


  constructor(logger: Logger) {
    this.logger = logger;
  }

  public create<T>(name: string, actor: Actor<T>, skipOp = false): ActorRef<T> {
    const actorInfo = new ActorInfo(name, actor);
    const ref = new ActorRefImpl(actorInfo, this);
    actorInfo.ref = ref;
    this.actors.push(actorInfo);
    if (!skipOp) {
      this.getCurrActorInfo().bufferedOps.push(new OpImpl(OpType.Create, actorInfo));
    }
    return ref;
  }

  public currActor<T>(): ActorRef<T> {
    return this.getCurrActorInfo().ref;
  }

  public getCustomData<T>(key: string): T {
    return this.getCurrActorInfo().customData.get(key) as T;
  }

  public setCustomData<T>(key: string, val: T): void {
    this.getCurrActorInfo().customData.set(key, val);
  }

  public isTesting(): boolean {
    return true;
  }

  public getCurrActorInfo(): ActorInfo {
    if (!this.currActorInfo) {
      throw new Error("Could not get current actor!");
    }
    return this.currActorInfo;
  }

  public fail(reason: any): void {
    this.logger.log("error", "Failure: ", reason);
    this.failed = true;
    this.failure = reason;
  }

  public hasFailed(): boolean {
    return this.failed;
  }

  public getFailure(): any {
    if (!this.hasFailed()) {
      throw new Error("Called `getFailure()` when `hasFailed()` is false.");
    }
    return this.failure;
  }

  public doExecution(strategy: SchedulingStrategy, initialActor: Actor<any>): void {

    // clear actors array
    this.actors.length = 0;
    this.currActorInfo = undefined;

    this.failed = false;
    this.failure = undefined;

    this.create("Main", initialActor, true);
    this.actors[0].enabled = true;
    this.actors[0].mailbox.push(new Object());
    this.actors[0].nextOp = this.actors[0].bufferedOps.shift()!;

    while (!this.failed) {
      // Query strategy
      const i = strategy.chooseNextThread(this.actors);
      if (i < 0) {
        // deadlock
        return;
      }
      // Execute op
      const nextActor = this.actors[i];
      assert(nextActor.enabled);
      switch (nextActor.nextOp.type) {
        case OpType.Create:
          const target = nextActor.nextOp.target;
          target.enabled = true;
          target.nextOp = target.bufferedOps.shift()!;
          break;
        case OpType.Start:
          // nothing
          break;
        case OpType.End:
          // nothing
          break;
        case OpType.Send:
          nextActor.nextOp.target.mailbox.push(nextActor.nextOp.val);
          if (!nextActor.nextOp.target.terminated) {
            nextActor.nextOp.target.enabled = true;
          }
          break;
        case OpType.Receive:
          assert(nextActor.mailbox.length > 0);
          const msg = nextActor.mailbox.shift();
          this.currActorInfo = nextActor;
          nextActor.handler.handle(msg);
          this.currActorInfo = undefined;
          // disable the actor later (below)
          break;
      }
      // Update actor's nextOp
      if (nextActor.bufferedOps.length > 0) {
        nextActor.nextOp = nextActor.bufferedOps.shift()!;
      } else {
        nextActor.nextOp = new OpImpl(OpType.Receive, nextActor);
        if (nextActor.mailbox.length === 0) {
          nextActor.enabled = false;
        }
      }
    }
  }
}
