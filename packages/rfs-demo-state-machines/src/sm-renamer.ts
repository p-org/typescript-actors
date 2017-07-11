import * as path from "path";
import { StateMachine, StateMachineRuntime, StateResult } from "state-machines";
import { FSActor } from "./fs-mock";

export class SMRenamer implements StateMachine<any, any, any> {
  public sm: StateMachineRuntime<any, any>;
  constructor(public fs: FSActor) { }
  public stateInit(_: any): StateResult {
    return this.sm.executeCustomHandler(async (): Promise<any> => {
      this.fs.renameAsync(
        path.join("testdata", "file.txt"),
        path.join("testdata", "file2.txt"));
      return;
    });
  }
}

