
import * as assert from "assert";
import { Receiver, ReceivingActor } from "./receive";
import { Actor, ActorRef, ActorRuntime } from "./simple";

type Predicate<T> = (m: T) => boolean;

class PromiseInfo<T> {
  public promise: Promise<T>;
  public predicate: Predicate<T>;
  public resolveFunc: any;

  // PromiseInfos in receiveCalls are set to ignored when the handle method returns.
  // They should arguably never be processed. However...
  // Regarding interleavedReceives:
  //   If interleavedReceives === true: ignored receives will be processed if the appropriate msg is received.
  //   Otherwise: ignored receives will never be processed.
  public ignore: boolean;

  constructor(
    promise: Promise<T>,
    predicate: Predicate<T>,
    resolveFunc: any,
  ) {
    this.promise = promise;
    this.predicate = predicate;
    this.resolveFunc = resolveFunc;
    this.ignore = false;
   }
}

class MsgBuffer<T> {
  private buffer: T[];
  private index: number;

  constructor() {
    this.buffer = [];
    this.index = 0;
  }

  public pushBack(msg: T): void {
    this.buffer.push(msg);
  }

  public get(): T {
    return this.buffer[this.index];
  }

  public getAndIncrement(): T {
    const res = this.get();
    this.increment();
    return res;
  }

  public remove(): void {
    this.buffer.splice(this.index, 1);
  }

  public increment(): void {
    this.index += 1;
  }

  public reset(): void {
    this.index = 0;
  }

  public inBounds(): boolean {
    return this.index < this.buffer.length;
  }

}

function synchronousScheduler(callback: (...args: any[]) => void): void {
  callback();
}

class DummyMsg {
  // Nothing
}


export class ReceivingActorImpl<T> implements Actor<T> {
  public static RECEIVER_KEY = "_receiver";

  private readonly nestedActor: ReceivingActor<T>;
  private readonly runtime: ActorRuntime;
  private readonly receiver: Receiver<T>;
  private readonly receiveCalls: Array<PromiseInfo<T>>;
  private readonly buffer: MsgBuffer<T>;

  // If true, `awaitingPromise` will never be set
  // and so messages will never be skipped while waiting
  // for the Promise returned by the nestedActor.handle function to complete.
  private readonly interleavedReceives: boolean;

  private customSchedulerSet: boolean;
  private awaitingPromise: boolean;
  private self: ActorRef<T | DummyMsg>;

  constructor(nestedActor: ReceivingActor<T>, runtime: ActorRuntime, interleavedReceives = false) {
    this.nestedActor = nestedActor;
    this.runtime = runtime;
    this.receiver = { receive: this.receive.bind(this) };
    this.receiveCalls = [];
    this.buffer = new MsgBuffer<T>();
    this.interleavedReceives = interleavedReceives;

    this.customSchedulerSet = false;
    this.awaitingPromise = false;
  }

  public handle(msgTemp: T): void {
    // Lazily init self actor ref.
    if (!this.self) { this.self = this.runtime.currActor(); }

    this.buffer.pushBack(msgTemp);

    outer:
    while (this.buffer.inBounds()) {
      const msg = this.buffer.get();

      // Dummy message is just used (in production) to wake up this actor
      // after a Promise has been made non-pending due to some external event.
      // But we must reset the buffer pointer so we consider all messages again
      // because we probably can now handle them. (Maybe we sometimes don't need to?)
      if (msg instanceof DummyMsg) {
        assert(!this.runtime.isTesting());
        this.buffer.remove();
        this.buffer.reset();
        continue;
      }

      // IF there are (non-ignored) receives THEN... awaitingPromise OR interleavedReceives.
      assert(
        !(this.receiveCalls.filter((r) => !r.ignore).length > 0) || (this.awaitingPromise || this.interleavedReceives));

      // Test each receive call for match.
      // tslint:disable-next-line:prefer-for-of
      for (let i = 0; i < this.receiveCalls.length; ) {
        if (this.receiveCalls[i].predicate(msg)) {
          // match!
          this.buffer.remove();
          const rc = this.receiveCalls[i];
          this.receiveCalls.splice(i, 1);

          // See `ignore` above.
          if (rc.ignore && !this.interleavedReceives) {
            // Don't process the message.
            // No need to reset buffer pointer (I think).
            continue outer;
          }

          // handle the message
          assert(this.runtime.getCustomData(ReceivingActorImpl.RECEIVER_KEY) === undefined);
          this.runtime.setCustomData(ReceivingActorImpl.RECEIVER_KEY, this.receiver);
          const oldScheduler = (Promise as any).setScheduler(synchronousScheduler) as any;
          this.customSchedulerSet = true;
          rc.resolveFunc(msg);
          assert(this.runtime.getCustomData(ReceivingActorImpl.RECEIVER_KEY) === this.receiver);
          this.runtime.setCustomData(ReceivingActorImpl.RECEIVER_KEY, undefined);
          (Promise as any).setScheduler(oldScheduler);
          this.customSchedulerSet = false;
          // must reset buffer pointer as we might now be able to handle deferred messages
          this.buffer.reset();
          continue outer;
        }
        // We could increment i from the for statement (because we exit the loop if we mutate this.receiveCalls)
        // but this makes it clearer that care is needed:
        ++i;
      }

      if (this.awaitingPromise) {
        // defer message.
        this.buffer.increment();
        continue;
      }

      this.buffer.remove();

      // See `ignore` above.
      // receiveCalls should be empty or all ignored.
      if (!this.interleavedReceives) {
        for (const rc of this.receiveCalls) {
          assert(rc.ignore);
        }
      }

      assert(this.runtime.getCustomData(ReceivingActorImpl.RECEIVER_KEY) === undefined);
      this.runtime.setCustomData(ReceivingActorImpl.RECEIVER_KEY, this.receiver);
      const oldScheduler = (Promise as any).setScheduler(synchronousScheduler) as any;
      this.customSchedulerSet = true;
      const res = this.nestedActor.handle(msg, this.receiver);

      res.catch((ex) => {
        console.error(`WARNING: the receive actor threw an exception.`, this.self, ex);
      });

      assert(this.runtime.getCustomData(ReceivingActorImpl.RECEIVER_KEY) === this.receiver);
      this.runtime.setCustomData(ReceivingActorImpl.RECEIVER_KEY, undefined);
      (Promise as any).setScheduler(oldScheduler);
      this.customSchedulerSet = false;

      if (res.isPending() && !this.interleavedReceives) {
        assert(!this.awaitingPromise);
        this.awaitingPromise = true;
        res.finally(() => {
          assert(
            !this.runtime.isTesting() || this.customSchedulerSet,
            "In testing mode and an awaited Promise became non-pending without the synchronous scheduler!");
          assert(this.awaitingPromise);
          this.awaitingPromise = false;

          // See `ignore` above.
          for (const rc of this.receiveCalls) {
            rc.ignore = true;
          }

          if (!this.customSchedulerSet) {
            // We awaited a Promise that became non-pending due to some external event.
            // Thus, we send a dummy message to ourselves to ensure this actor is "woken up"
            // to process any deferred messages.
            this.self.send(new DummyMsg());
          }
        });
      } else if (!res.isPending()) {
        // See `ignore` above.
        for (const rc of this.receiveCalls) {
          rc.ignore = true;
        }
      }
    } // end while

    // Handled all messages that we can right now.
  }

  private receive(predicate: Predicate<T>): Promise<T> {
    let resolveFunc;
    const promise = new Promise<T>((resolve) => { resolveFunc = resolve; });
    this.receiveCalls.push(new PromiseInfo(promise, predicate, resolveFunc));
    return promise;
  }

}
