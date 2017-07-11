

export enum OpType {
  Create, Start, End, Send, Receive,
}

export interface Op {
  type: OpType;
}

export interface Thread {
  nextOp: Op;
  enabled: boolean;
}

export interface SchedulingStrategy {
  chooseNextThread(threads: Thread[]): number;
  prepareForNextSchedule(): boolean;
}
