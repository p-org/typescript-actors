import { ActorRuntime, ActorUtil, SimpleRuntimeFactory,
  TypedActorRuntime, TypedActorRuntimeFactory } from "async-actors";
import * as express from "express";
import * as sm from "state-machines";
import { FsStateMachinesFactory } from "./fs-statemachines";
import { SMLoadDirInfo } from "./sm-load-dir-info";
import { SMLoadFile } from "./sm-load-file";
import * as util from "./util";

ActorUtil.defaultProductionSetup();

const rootDir = "testdata";
const runtime: ActorRuntime = SimpleRuntimeFactory.create();
const typedRuntime: TypedActorRuntime = TypedActorRuntimeFactory.create(runtime);
const smRuntime = sm.StateMachineRuntimeFactory.create(typedRuntime);
const app = express();
const fsMachinesFactory = new FsStateMachinesFactory(typedRuntime);


app.set("view engine", "ejs");
app.set("views", util.canonicalPath(__dirname, "../views"));

// First request handler sets no-cache and passes the request on.
function noCache(_: express.Request, res: express.Response, next: express.NextFunction) {
    res.setHeader("Cache-Control", "no-cache");
    next();
}

// Helper
async function loadDirectoryInfo(req: express.Request, res: express.Response, view: string): Promise<void> {
  try {
    const path = req.params.subpath ? util.canonicalPath(rootDir, req.params.subpath) : rootDir;
    const o: any = new SMLoadDirInfo();
    o.fs = fsMachinesFactory;
    const ref = smRuntime.create(o, [ rootDir, path ]);
    const results = await smRuntime.execute(ref);
    res.render(view, { files: results });
  } catch (ex) {
    console.log("Exception: " + ex);
    if (ex.stack) {
      console.log(ex.stack);
    }
    res.send("Exception: " + ex);
  }
}

app.get("/", noCache, (req, res) => {
  loadDirectoryInfo(req, res, "index.ejs");
});

app.get("/subdir/", noCache, (req, res) => {
  loadDirectoryInfo(req, res, "dir.ejs");
});

// Parameters are prefixed with a colon.

app.get("/subdir/:subpath", noCache, (req, res) => {
  loadDirectoryInfo(req, res, "dir.ejs");
});

// Note this one is async.
app.get("/contents/:subpath", noCache, async (req, res) => {
  try {
    const path = util.canonicalPath(rootDir, req.params.subpath);
    const o: any = new SMLoadFile();
    o.fs = fsMachinesFactory;
    const ref = smRuntime.create(o, path);
    const output = await smRuntime.execute(ref);
    res.send(output);
  } catch (ex) {
    console.log("Exception: " + ex);
    res.send("Exception: " + ex);
  }
});

app.use((err: any, _1: express.Request, res: express.Response, _3: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).send("Something broke!");

  setTimeout(() => {
      process.exit(1);
  }, 100);
});

app.listen(3000, () => {
    console.log("Server running on http://127.0.0.1:3000");
});
