

export interface Logger {
  log(level: string, msg: string, ...args: any[]): void;
}
