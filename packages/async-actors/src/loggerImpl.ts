

export interface Logger {
  log(level: "info" | "warn" | "error", msg: string, ...args: any[]): void;
}

export class SimpleLogger implements Logger {
  public log(level: "info" | "warn" | "error", msg: string, ...args: any[]): void {
    switch (level) {
      case "info":
        console.info(msg, ...args);
        break;
      case "warn":
        console.warn(msg, ...args);
        break;
      case "error":
        console.error(msg, ...args);
        break;
      default:
        console.error("LEVEL? " + msg, ...args);
        break;
    }
  }

}
