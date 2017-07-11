import * as Async from "async";
import * as Express from "express";
import * as Fs from "fs";
import * as Path from "path";

interface PathInfoRecord { name: string; kind: FileKind; }
interface PathInfoDisplayRecord { isfile: boolean; elemid: string; shortname: string; encodedname: string; }
type PathInfoCB = (err: any, info: PathInfoRecord) => void;

let idctr = 0;

type FileInfoGetterAyncFunc = (callback: PathInfoCB) => void;

function createSinglePathInfoGetter(fullpath: string): FileInfoGetterAyncFunc {

  // An "async func"" (according to the "async" module) gives its result to a callback.
  return (callback: PathInfoCB): void => {
    Fs.stat(fullpath, (err, stats): void => {
      let fkind = FileKind.Invalid;
      if (!err) {
        if (stats.isFile()) {
          fkind = FileKind.File;
        } else if (stats.isDirectory()) {
          fkind = FileKind.Directory;
        } else {
          fkind = FileKind.Other;
        }
      }

      callback(err, { name: fullpath, kind: fkind });
    });
  };
}

function processForDisplay(info: PathInfoDisplayRecord[]) {
  info.sort((a, b) => {
    if (a.isfile !== b.isfile) {
      return a.isfile ? 1 : -1;
    } else {
      return a.shortname.localeCompare(b.shortname);
    }
  });
}

enum FileKind {
  Invalid = 0,
  File = 1,
  Directory = 2,
  Other = 3,
}

export function canonicalPath(...args: string[]): string {
  return Path.normalize(Path.join(...args));
}

function htmlEncodeContent(unsafeStr: string): string {
  const escaped = unsafeStr
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/\'/g, "&#39;");
  const wstrans = escaped
    .replace(/ /g, "&nbsp;")
    .replace(/(\r\n)|(\n)/g, "<br />")
    .replace(/\t/g, "&nbsp;&nbsp;&nbsp;&nbsp;");

  return wstrans;
}

function processFileLoadForDisplay(path: string, data: string): string {
  let output = "";

  if (data === "") {
    output = `<em>The file '${Path.basename(path)}' is empty!</em>`;
  } else if (Path.extname(path) === ".js" || Path.extname(path) === ".html") {
    const htmlstr = htmlEncodeContent(data.toString());
    output = `<code>${htmlstr}</code>`;
  } else if (Path.extname(path) === ".txt" || Path.extname(path) === ".log") {
    const htmlstr = htmlEncodeContent(data.toString());
    output = `<div class="plaintext">${htmlstr}</div>`;
  } else {
    output = `<em>Cannot display the content of '${Path.basename(path)}'.</em>`;
  }

  return output;
}

export function loadFileInfo(rootDir: string, req: Express.Request, res: Express.Response): void {
  const path = canonicalPath(rootDir, req.params.subpath);

  Fs.readFile(path, "utf8", (/*err*/_: any, data: string) => {
    if (typeof data !== "string") {
      res.status(501).send("Faild to read file!");
      return;
    }
    const output = processFileLoadForDisplay(path, data);
    res.send(output);
  });
}

export function loadDirectoryInfo(
  rootDir: string,
  req: Express.Request,
  res: Express.Response,
  viewName: string): void {

  const path = req.params.subpath ? canonicalPath(rootDir, req.params.subpath) : rootDir;

  Fs.readdir(path, (/*err*/_, files) => {

    if (!files) {
      res.status(501).send(`Error accessing files!`);
      return;
    }

    // Make sure we only include paths that really are in the requested path.
    const flist = files.filter((value) => {
      const fullpath = canonicalPath(path, value);
      return (fullpath.length > path.length) && (fullpath.substr(0, path.length) === path);
    });

    // Get a list of async funcs to get file info; one for each file.
    const fileInfoGetters: FileInfoGetterAyncFunc[] =
      flist.map((value) => createSinglePathInfoGetter(canonicalPath(path, value)));

    Async.parallel(
      fileInfoGetters,
      (err2, results) => {
        let tresults = new Array<PathInfoDisplayRecord>();
        if (!err2 && results) {
          tresults = results
            .filter((value) => (value && (value.kind === FileKind.File || value.kind === FileKind.Directory)))
            .map((value) => {

              if (!value) { throw Error("Undefined result"); }

              const isfile = (value.kind === FileKind.File);
              const id = "_eid" + idctr++;
              const shortname = Path.basename(value.name) + (isfile ? "" : Path.sep);
              const encodedname =
                encodeURIComponent(value.name.substr(rootDir.length) + (isfile ? "" : Path.sep));

              return { isfile, elemid: id, shortname, encodedname };
            });
        }

        processForDisplay(tresults);
        res.render(viewName, { files: tresults });
      });
  });
}
