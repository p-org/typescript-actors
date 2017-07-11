
// The plan was to use this to mark typed actor interfaces.
// But currently, any interface can be used as a typed actor.
// tslint:disable-next-line:no-empty-interface
export interface TypedActor {

}

export interface TypedActorRuntime {
  create<T>(name: string, typedActor: object, interleavedAwaits?: boolean): T;
}
