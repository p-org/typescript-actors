

export interface ReceivingActor<T> {
  handle(msg: T, receiver: Receiver<T>): Promise<void>;
}

export interface Receiver<T> {
  receive<M extends T>(predicate: (m: T) => boolean): Promise<M>;
}
