
import * as Random from "random-js";
import { SchedulingStrategy, Thread } from "./strategy";

export class RandomStrategy implements SchedulingStrategy {

  private randomSeedGenerator: Random;
  private random: Random;

  constructor(seed: number) {
    this.randomSeedGenerator = new Random(Random.engines.mt19937().seed(seed));
  }

  public chooseNextThread(threads: Thread[]): number {
    const enabled = new Array<number>();
    for (let i = 0; i < threads.length; ++i) {
      if (threads[i].enabled) {
        enabled.push(i);
      }
    }
    if (enabled.length === 0) {
      return -1;
    }
    const i = this.random.integer(0, enabled.length - 1);
    const res = enabled[i];
    return res;
  }

  public prepareForNextSchedule(): boolean {
    this.random =
      new Random(Random.engines.mt19937().seed(this.randomSeedGenerator.integer(0, Number.MAX_SAFE_INTEGER)));
    return true;
  }

}
