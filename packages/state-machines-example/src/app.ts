
// StateMachine, StateMachineRuntime, StateResult

import { ActorUtil, SimpleRuntimeFactory, TypedActorRuntimeFactory } from "async-actors";
import { StateMachineRuntimeFactory } from "state-machines";

import { mainMachine } from "./jsExample";

ActorUtil.defaultProductionSetup();


// TypeScript example:
// class MyStateMachine implements StateMachine<number, number, string> {

//   public sm: StateMachineRuntime<number, string>;
//   private input: number;

//   public stateInit(input: number): StateResult {
//     this.input = input;

//     return this.sm.transitionTo(this.stateDoComputation);
//   }

//   public stateDoComputation(): StateResult {
//     return this.sm.completeWithSuccess(this.input * 2);
//   }

// }


function go() {

  const actorRuntime = SimpleRuntimeFactory.create();
  const typedActorRuntime = TypedActorRuntimeFactory.create(actorRuntime);
  const smRuntime = StateMachineRuntimeFactory.create(typedActorRuntime);

  const machine = smRuntime.create(mainMachine as any, 6);

  smRuntime.execute(machine).then((result: number): void => {
    console.log("Got " + result);
  },
  (reason: any): void => {
    console.log("Error: " + JSON.stringify(reason));
  });

}

go();
