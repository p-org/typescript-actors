import * as Bluebird from "bluebird";
import { Logger } from "./logger";
import { SimpleLogger } from "./loggerImpl";
import { Receiver, ReceivingActor } from "./receive";
import { ReceivingActorImpl } from "./receiveImpl";
import { TestingRuntime } from "./simple";
import { SchedulingStrategy } from "./strategies/strategy";
import { TypedActorRuntime } from "./typed";

// No type defs for exit-hook. Import using require.
// tslint:disable-next-line:no-var-requires
const exitHook = require("exit-hook");

export class ActorUtil {
  public static readonly unhandledPromises: Array<Bluebird<any>> = [];
  public static readonly logger: Logger = new SimpleLogger();

  public static overrideScheduler(runtime: TestingRuntime) {
    (Promise as any).setScheduler((_: (...args: any[]) => void): void => {
      runtime.fail(new Error("Tried to schedule a callback!"));
    });
  }

  public static overrideUnhandledPromises() {
    Promise.onPossiblyUnhandledRejection((_: Error, promise: Bluebird<any>) => {
      ActorUtil.unhandledPromises.push(promise);
    });

    (Promise as any).onUnhandledRejectionHandled((promise: Bluebird<any>) => {
      const index = ActorUtil.unhandledPromises.indexOf(promise);
      if (index < 0) {
        return;
      }
      ActorUtil.unhandledPromises.splice(index, 1);
    });
  }

  public static checkUnhandledPromises(logger: Logger) {
    for (const p of ActorUtil.unhandledPromises) {
      logger.log("error", "Unhandled promise: ", p);
    }
  }

  public static resetUnhandledPromises() {
    ActorUtil.unhandledPromises.length = 0;
  }

  public static overridePromises() {
    global.Promise = Bluebird;
  }

  public static checkUnhandledPromisesOnExit(logger: Logger) {
    exitHook(() => {
      logger.log("info", "Checking promises: ");
      ActorUtil.checkUnhandledPromises(logger);
    });
  }

  public static defaultProductionSetup(logger: Logger = ActorUtil.logger) {
    ActorUtil.overridePromises();
    ActorUtil.overrideUnhandledPromises();
    ActorUtil.checkUnhandledPromisesOnExit(logger);
  }

  public static testActor(
    runtime: TestingRuntime,
    typedRuntime: TypedActorRuntime,
    maxExecutions: number,
    strategy: SchedulingStrategy,
    harness: Harness,
    logger: Logger = ActorUtil.logger) {

    ActorUtil.overridePromises();
    ActorUtil.overrideUnhandledPromises();

    for (let i = 0; i < maxExecutions; ++i) {
      if (!strategy.prepareForNextSchedule()) {
        logger.log("info", "No more schedules.");
        break;
      }
      ActorUtil.overrideScheduler(runtime);
      ActorUtil.resetUnhandledPromises();
      logger.log("info", `Starting execution ${i}.`);

      runtime.doExecution(
        strategy,
        new ReceivingActorImpl(new HarnessReceivingActor(runtime, typedRuntime, harness), runtime));

      ActorUtil.checkUnhandledPromises(logger);
      logger.log("info", "Execution done.");
    }
  }
}

class HarnessReceivingActor implements ReceivingActor<any> {

  constructor(
    public runtime: TestingRuntime,
    public typedRuntime: TypedActorRuntime,
    public harness: Harness,
  ) { }

  public handle(_: any, receiver: Receiver<any>): Promise<void> {
    return this.harness.main(this.runtime, this.typedRuntime, receiver);
  }

}


export interface Harness {
  main(runtime: TestingRuntime, typedRuntime: TypedActorRuntime, receiver: Receiver<any>): Promise<void>;
}

