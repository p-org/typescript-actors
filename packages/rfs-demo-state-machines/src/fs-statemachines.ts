
import { TypedActorRuntime } from "async-actors";
import * as fs from "fs-extra-promise";
import { StateMachine, StateMachineRuntime, StateResult } from "state-machines";
import { FSActor, FSActorMock } from "./fs-mock";


class SMReadDir implements StateMachine<string, string[], any> {
  public sm: StateMachineRuntime<string[], any>;
  constructor(public fs: FSActor) { }
  public stateInit(input: string): StateResult {
    return this.sm.executeCustomHandler((): Promise<string[]> => {
      return this.fs.readdirAsync(input);
    });
  }
}

class SMStat implements StateMachine<string, fs.Stats, any> {
  public sm: StateMachineRuntime<fs.Stats, any>;
  constructor(public fs: FSActor) { }
  public stateInit(input: string): StateResult {
    return this.sm.executeCustomHandler((): Promise<fs.Stats> => {
      return this.fs.statAsync(input);
    });
  }
}

class SMReadFile implements StateMachine<[string, string], string, any> {
  public sm: StateMachineRuntime<string, any>;
  constructor(public fs: FSActor) { }
  public stateInit(input: [string, string]): StateResult {
    return this.sm.executeCustomHandler((): Promise<string> => {
      return this.fs.readFileAsync(input[0], input[1]);
    });
  }
}

export class FsStateMachinesFactory {
  public fs: FSActor;

  constructor(typedRuntime: TypedActorRuntime, mock = false) {
    this.fs = mock ? typedRuntime.create<FSActor>("FSActor", new FSActorMock(), true) : fs as any;
  }

  public readdir(): StateMachine<string, string[], any> {
    return new SMReadDir(this.fs);
  }
  public stat() {
    return new SMStat(this.fs);
  }
  public readfile() {
    return new SMReadFile(this.fs);
  }
}

