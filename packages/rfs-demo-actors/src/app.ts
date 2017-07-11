import { ActorRuntime, ActorUtil, SimpleRuntimeFactory,
  TypedActorRuntime, TypedActorRuntimeFactory } from "async-actors";
import * as express from "express";
import * as fs from "fs-extra-promise";
import { FSActor, FSServerActor, FSServerActorImpl } from "./actorsAsync";
import * as util from "./util";

ActorUtil.defaultProductionSetup();

// `__dirname` is a node global

const rootDir = "testdata"; // util.canonicalPath(__dirname, "../testdata");

// Create actor runtimes and actors:

const runtime: ActorRuntime = SimpleRuntimeFactory.create();
const typedRuntime: TypedActorRuntime = TypedActorRuntimeFactory.create(runtime);

// Here, we use the `fs` *module* as the actor implementation! (As opposed to a class instance.)
// This is possible because the method signatures of the FSActor interface match perfectly.
// We would use a mock class for testing.
const fsActorProxy = typedRuntime.create<FSActor>("FSActor", fs, true); // new FSActorMock()
const fsServerActorProxy =
  typedRuntime.create<FSServerActor>("FSServerActor", new FSServerActorImpl(fsActorProxy), true);


const app = express();
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
    const results = await fsServerActorProxy.loadDirectoryInfo(rootDir, path);
    res.render(view, { files: results });
  } catch (ex) {
    console.log("Exception: " + ex);
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

// Note this is one is async
app.get("/contents/:subpath", noCache, async (req, res) => {
  try {
    const path = util.canonicalPath(rootDir, req.params.subpath);
    const output = await fsServerActorProxy.loadFileInfo(path);
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
