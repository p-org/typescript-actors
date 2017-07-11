import * as Bluebird from "bluebird";

global.Promise = Bluebird;

import {
  ActorUtil,
  Harness,
  RandomStrategy,
  Receiver,
  TestingRuntime,
  TestingRuntimeFactory,
  TypedActorRuntime,
  TypedActorRuntimeFactory} from "async-actors";

import * as assert from "assert";

import * as path from "path";

import { FSActor, FSActorMock, FSServerActor, FSServerActorImpl, RenamerActor, RenamerActorImpl } from "./actorsAsync";


class TestRenaming implements Harness {
  public async main(_1: TestingRuntime, typedRuntime: TypedActorRuntime, _2: Receiver<any>): Promise<void> {
    const fsActor = typedRuntime.create<FSActor>("FSActor", new FSActorMock(), true);
    const fsServerActor =
      typedRuntime.create<FSServerActor>("FSServerActor", new FSServerActorImpl(fsActor), true);
    const renamerActor = typedRuntime.create<RenamerActor>("RenamerActor", new RenamerActorImpl(fsActor));
    renamerActor.sendGo();
    const dir = await fsServerActor.loadDirectoryInfo("testdata", "testdata");
    const first = dir.filter((f) => f.isfile).shift();
    if (!first) {
      throw new Error();
    }
    const fileContents = await fsServerActor.loadFileInfo(path.join("testdata", first.shortname));
    assert(fileContents === "filecontents");
  }
}



function go() {
  const runtime = TestingRuntimeFactory.create();
  const typedRuntime = TypedActorRuntimeFactory.create(runtime);
  const strategy = new RandomStrategy(0);
  const testRenaming = new TestRenaming();

  ActorUtil.testActor(runtime, typedRuntime, 5, strategy, testRenaming);

}

go();


