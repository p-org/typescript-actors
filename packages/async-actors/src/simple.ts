

import { SchedulingStrategy } from "./strategies/strategy";

export interface Actor<T> {
  handle(msg: T): void;
}

export interface ActorRef<T> {
  send(msg: T): void;
}

export interface ActorRuntime {
  create<T>(name: string, actor: Actor<T>): ActorRef<T>;
  currActor<T>(): ActorRef<T>;
  getCustomData<T>(key: string): T;
  setCustomData<T>(key: string, val: T): void;
  isTesting(): boolean;
}

export interface TestingRuntime extends ActorRuntime {
  doExecution(strategy: SchedulingStrategy, initialActor: Actor<any>): void;
  fail(reason: any): void;
  hasFailed(): boolean;
  getFailure(): any;
}


