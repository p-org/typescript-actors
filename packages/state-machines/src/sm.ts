import { TypedActorRuntime } from "async-actors";

// tslint:disable:no-empty-interface

export interface StateResult {

}

// The `declare` keyword here suppresses the type parameters not used "error".
export declare interface StateMachineRef<InputType, SuccessType, ErrorType> {

}

export interface StateMachineRuntime<SuccessType, ErrorType> {

  transitionTo(state: () => StateResult): StateResult;
  completeWithSuccess(result: SuccessType): StateResult;
  completeWithError(reason: ErrorType): StateResult;

  create<InputType, SuccessType, ErrorType>(
    machine: StateMachine<InputType, SuccessType, ErrorType>,
    input: InputType,
  ): StateMachineRef<InputType, SuccessType, ErrorType>;

  callTo<I, R, E>(
    machine: StateMachineRef<I, R, E>,
    successState: (result: R) => StateResult,
    errorState: (reason: E) => StateResult,
  ): StateResult;

  callToAll<I, R, E>(
    machines: Array<StateMachineRef<I, R, E>>,
    successState: (results: R[]) => StateResult,
    errorState: (reason: E) => StateResult,
  ): StateResult;

  check(condition: boolean, falseState?: () => StateResult): void;

  executeCustomHandler(handler: () => Promise<SuccessType>): StateResult;

}

export interface StateMachineRuntimeExternal {
  create<InputType, SuccessType, ErrorType>(
    machine: StateMachine<InputType, SuccessType, ErrorType>,
    input: InputType,
  ): StateMachineRef<InputType, SuccessType, Error>;

  execute<InputType, SuccessType, ErrorType>(
    machine: StateMachineRef<InputType, SuccessType, ErrorType>,
    ): Promise<SuccessType>;

  executeAndForget<InputType, SuccessType, ErrorType>(
    machine: StateMachineRef<InputType, SuccessType, ErrorType>,
    ): void;

}

export interface StateMachine<InputType, SuccessType, ErrorType> {
  sm: StateMachineRuntime<SuccessType, ErrorType>;
  stateInit(input: InputType): StateResult;
  onAbort?(): void;
  onCanceled?(): StateResult;
}

export class StateMachineRuntimeFactory {
  public static create(typedActorRuntime: TypedActorRuntime): StateMachineRuntimeExternal {
    return new StateMachineRuntimeExternalImpl(typedActorRuntime);
  }
}



class StateMachineRefImpl implements StateMachineRef<any, any, any> {
  constructor(public actorProxy: StateMachineActor) {}
}

type StateResultReal =
  TransitionTo |
  CallTo |
  CallToAll |
  CompleteWithSuccess |
  CompleteWithError
;

class TransitionTo implements StateResult {
  constructor(public state: () => StateResult) { }
}

class CallTo implements StateResult {
  constructor(
    public machine: StateMachineRefImpl,
    public successState: (result: any) => StateResult,
    public errorState: (reason: any) => StateResult,
  ) {

  }
}

class CallToAll implements StateResult {
  constructor(
    public machines: StateMachineRefImpl[],
    public successState: (results: any[]) => StateResult,
    public errorState: (reason: any) => StateResult,
  ) {

  }
}

class CompleteWithSuccess implements StateResult {
  constructor(public result: any) { }
}

class CompleteWithError implements StateResult {
  constructor(public reason: any) { }
}

class ExecuteCustomHandler implements StateResult {
  constructor(public handler: () => Promise<any>) { }
}

class StateMachineRuntimeExternalImpl implements StateMachineRuntimeExternal {

  // Create a state machine.
  public static createStateMachine<InputType, SuccessType, ErrorType>(
    typedActorRuntime: TypedActorRuntime,
    machine: StateMachine<InputType, SuccessType, ErrorType>,
    input: InputType,
  ): StateMachineRef<InputType, SuccessType, Error> {

    return new StateMachineRefImpl(
        typedActorRuntime.create<StateMachineActor>(
          "StateMachineActor",
          new StateMachineActorImpl(typedActorRuntime, machine, input)));
  }

  constructor(private typedActorRuntime: TypedActorRuntime) {

  }

  public create<InputType, SuccessType, ErrorType>(
    machine: StateMachine<InputType, SuccessType, ErrorType>,
    input: InputType)
  : StateMachineRef<InputType, SuccessType, Error> {

    return StateMachineRuntimeExternalImpl.createStateMachine(
      this.typedActorRuntime,
      machine,
      input);
  }

  public execute<InputType, SuccessType, ErrorType>(
    machine: StateMachineRef<InputType, SuccessType, ErrorType>)
  : Promise<SuccessType> {

    if (machine instanceof StateMachineRefImpl) {
      return machine.actorProxy.go();
    }
    return Promise.reject(new Error("Unrecognized machine ref."));
  }

  public executeAndForget<InputType, SuccessType, ErrorType>(
    machine: StateMachineRef<InputType, SuccessType, ErrorType>)
  : void {
    if (machine instanceof StateMachineRefImpl) {
      machine.actorProxy.sendGo();
      return;
    }
    throw new Error("Unrecognized machine ref.");
  }

}

class StateMachineRuntimeImpl<SuccessType, ErrorType> implements StateMachineRuntime<SuccessType, ErrorType> {

  constructor(private typedActorRuntime: TypedActorRuntime) { }

  public create<InputType, SuccessType, ErrorType>(
    machine: StateMachine<InputType, SuccessType, ErrorType>,
    input: InputType,
  ): StateMachineRef<InputType, SuccessType, Error> {

    return StateMachineRuntimeExternalImpl.createStateMachine(
      this.typedActorRuntime,
      machine,
      input);
  }

  public transitionTo(state: () => StateResult): StateResult {
    return new TransitionTo(state);
  }
  public completeWithSuccess(result: SuccessType): StateResult {
    return new CompleteWithSuccess(result);
  }
  public completeWithError(reason: ErrorType): StateResult {
    return new CompleteWithError(reason);
  }

  public callTo<I, R, E>(
    machine: StateMachineRef<I, R, E>,
    successState: (result: R) => StateResult,
    errorState: (reason: E) => StateResult): StateResult {

    return new CallTo(machine as StateMachineRefImpl, successState, errorState);
  }

  public callToAll<I, R, E>(
    machines: Array<StateMachineRef<I, R, E>>,
    successState: (results: R[]) => StateResult,
    errorState: (reason: E) => StateResult): StateResult {
    return new CallToAll(machines as StateMachineRefImpl[], successState, errorState);
  }

  public check(condition: boolean, falseState?: () => StateResult): void {
    if (!condition) {
      const err = new Error("check failed.");
      if (falseState) {
        throw new MachineCheckFailedSoTransitionException(err, falseState);
      } else {
        throw new MachineCheckFailedException(err);
      }
    }
  }

  public executeCustomHandler(handler: () => Promise<SuccessType>): StateResult {
    return new ExecuteCustomHandler(handler);
  }

}


export class MachineCheckFailedSoTransitionException {
  constructor(public error: Error, public falseState: () => StateResult) { }
}

export class MachineCheckFailedException {
  constructor(public error: Error) { }
}

export class MachineCanceledException {
  constructor(public error: Error) { }
}

export class MachineAbortedException {
  constructor(public error: Error) { }
}

interface StateMachineActor {
  go(): Promise<any>;
  sendGo(): Promise<void>;
}

class StateMachineActorImpl
  implements StateMachineActor {

  constructor(
    private typedActorRuntime: TypedActorRuntime,
    private stateMachine: StateMachine<any, any, any>,
    private input: any,
  ) { }

  public async sendGo(): Promise<void> {
    await this.go();
  }

  public async go(): Promise<any> {

    const sm = new StateMachineRuntimeImpl(this.typedActorRuntime);

    this.stateMachine.sm = sm;

    let res: StateResult;
    try {
      res = this.stateMachine.stateInit(this.input) as StateResultReal;
    } catch (ex) {
      res = this.handleException(ex);
    }

    while (true) {
      if (res instanceof TransitionTo) {
        try {
          res = res.state.call(this.stateMachine) as StateResultReal;
        } catch (ex) {
          res = this.handleException(ex);
          continue;
        }
        continue;
      }

      if (res instanceof CallTo) {
        let successResult: any;
        try {
          successResult = await res.machine.actorProxy.go();
        } catch (ex) {
          res = this.handleCallException(ex, res);
          continue;
        }
        try {
          res = res.successState.call(this.stateMachine, successResult);
        } catch (ex) {
          res = this.handleException(ex);
          continue;
        }
        continue;
      }

      if (res instanceof CallToAll) {
        let promises: Array<Promise<any>>;
        try {
          promises = res.machines.map((m) => m.actorProxy.go());
        } catch (ex) {
          throw new MachineAbortedException(new Error("Internal exception while calling go."));
        }
        let successResult: any[];
        try {
          successResult = await Promise.all(promises);
          // fallthrough
        } catch (ex) {
          // TODO: Cancel other machines?
          res = this.handleCallException(ex, res);
          continue;
        }
        res = res.successState.call(this.stateMachine, successResult);
        continue;
      }

      if (res instanceof CompleteWithSuccess) {
        return res.result;
      }

      if (res instanceof CompleteWithError) {
        throw res.reason;
      }

      if (res instanceof ExecuteCustomHandler) {
        return await res.handler();
      }

      throw new MachineAbortedException(new Error("Unexpected state result: " + res));
    }

  }

  private handleException(ex: any): StateResult {
    if (ex instanceof MachineCheckFailedSoTransitionException) {
      return new TransitionTo(ex.falseState);
    } else {
      throw new MachineAbortedException(ex);
    }
  }

  private handleCallException(ex: any, res: CallToAll | CallTo): StateResult {
    if (ex instanceof MachineCanceledException) {
      if (this.stateMachine.onAbort) {
        this.stateMachine.onAbort();
      }
      throw new MachineAbortedException(new Error("Machine was canceled unexpectedly."));
    }

    if (ex instanceof MachineAbortedException) {
      if (this.stateMachine.onAbort) {
        this.stateMachine.onAbort();
      }
      throw ex;
    }

    return res.errorState.call(this.stateMachine, ex);
  }

}
