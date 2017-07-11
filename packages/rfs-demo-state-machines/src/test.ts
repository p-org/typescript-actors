
import {
  ActorUtil,
  Harness,
  RandomStrategy,
  Receiver,
  TestingRuntime,
  TestingRuntimeFactory,
  TypedActorRuntime,
  TypedActorRuntimeFactory} from "async-actors";
import * as path from "path";
import { StateMachineRuntimeFactory } from "state-machines";
import { FsStateMachinesFactory } from "./fs-statemachines";
import { SMLoadDirInfo } from "./sm-load-dir-info";
import { SMLoadFile } from "./sm-load-file";
import { SMRenamer } from "./sm-renamer";
import * as util from "./util";


class TestRenaming implements Harness {

  public async main(_1: TestingRuntime, typedRuntime: TypedActorRuntime, _2: Receiver<any>): Promise<void> {
    try {
      const fsStateMachinesFactory = new FsStateMachinesFactory(typedRuntime, true);
      const sm = StateMachineRuntimeFactory.create(typedRuntime);
      const smRenamer = sm.create(new SMRenamer(fsStateMachinesFactory.fs), undefined);
      sm.executeAndForget(smRenamer);

      const o2: any = new SMLoadDirInfo();
      o2.fs = fsStateMachinesFactory;
      const smLoadDir = sm.create(o2, ["testdata", "testdata"]);
      const dir: util.PathInfoDisplayRecord[] = (await sm.execute(smLoadDir)) as any;
      const first = dir.filter((f) => f.isfile).shift();
      if (!first) {
        throw new Error();
      }

      const o3: any = new SMLoadFile();
      o3.fs = fsStateMachinesFactory;
      const smLoadFile = sm.create(o3, path.join("testdata", first.shortname));
      const fileContents: string = (await sm.execute(smLoadFile)) as any;
      if (fileContents !== "<div class=\"plaintext\">filecontents</div>") {
        throw new Error();
      }
    } catch (ex) {
      console.log(ex);
    }
  }
}



function go() {
  const runtime = TestingRuntimeFactory.create();
  const typedRuntime = TypedActorRuntimeFactory.create(runtime);
  const strategy = new RandomStrategy(0);
  const testRenaming = new TestRenaming();

  ActorUtil.testActor(runtime, typedRuntime, 100, strategy, testRenaming);

}

go();


