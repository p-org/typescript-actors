import * as Express from "express";
import * as Util from "./util";

// `__dirname` is a node global

const rootDir = Util.canonicalPath(__dirname, "../testdata");

const app = Express();
app.set("view engine", "ejs");
app.set("views", Util.canonicalPath(__dirname, "../views"));

// First request handler sets no-cache and passes the request on.
function noCache(_: Express.Request, res: Express.Response, next: Express.NextFunction) {
    res.setHeader("Cache-Control", "no-cache");
    next();
}

app.get("/", noCache, (req, res) => Util.loadDirectoryInfo(rootDir, req, res, "index.ejs"));

app.get("/subdir/", noCache, (req, res) => Util.loadDirectoryInfo(rootDir, req, res, "dir.ejs"));

// Parameters prefixed with a colon.

app.get("/subdir/:subpath", noCache, (req, res) => Util.loadDirectoryInfo(rootDir, req, res, "dir.ejs"));

app.get("/contents/:subpath", noCache, (req, res) => Util.loadFileInfo(rootDir, req, res));

app.use((err: any, _1: Express.Request, res: Express.Response, _3: Express.NextFunction) => {
  console.error(err.stack);
  res.status(500).send("Something broke!");

  setTimeout(() => {
      process.exit(1);
  }, 100);
});

app.listen(3000, () => {
    console.log("Server running on http://127.0.0.1:3000");
});
