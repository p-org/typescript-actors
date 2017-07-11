
import * as assert from "assert";
import * as fs from "fs-extra-promise";
import * as path from "path";
import * as util from "./util";

// tslint:disable:no-object-literal-type-assertion
// tslint:disable:no-unnecessary-initializer

// Actor interfaces

export interface FSActor {
  readdirAsync(path: string): Promise<string[]>;
  statAsync(path: string): Promise<fs.Stats>;
  readFileAsync(filename: string, encoding: string): Promise<string>;
  renameAsync(oldPath: string, newPath: string): Promise<void>;

}

export interface FSServerActor {
  loadDirectoryInfo(rootDir: string, directory: string): Promise<util.PathInfoDisplayRecord[]>;
  loadFileInfo(file: string): Promise<string>;
}

export interface RenamerActor {
  sendGo(): Promise<void>;
}



// Actor implementations

export class FSServerActorImpl implements FSServerActor {

  private fsActor: FSActor;
  private elemId: number;

  constructor(fsActor: FSActor) {
    this.fsActor = fsActor;
    this.elemId = 0;
  }

  public async loadDirectoryInfo(rootDir: string, directory: string): Promise<util.PathInfoDisplayRecord[]> {
    const files = await this.fsActor.readdirAsync(directory);
    const filtered = files.filter((f) => util.withinPath(directory, f));
    const fullpaths = filtered.map((f) => util.canonicalPath(directory, f));
    const asyncStats = fullpaths.map((f) => this.fsActor.statAsync(f) as Promise<fs.Stats>);

    const stats = await Promise.all(asyncStats);
    // stats contains all the stats, or an exception was thrown.
    const withFullPaths = util.zip(fullpaths, stats);
    const justFilesAndDirs = withFullPaths.filter(([_, v]) => v.isFile() || v.isDirectory());
    const infos = justFilesAndDirs.map(([n, s]) => ({
      elemid: "_eid" + this.elemId++,
      encodedname: encodeURIComponent(n.substr(rootDir.length) + (s.isFile() ? "" : path.sep)),
      isfile: s.isFile(),
      shortname: path.basename(n) + (s.isFile() ? "" : path.sep),
    }));
    util.processForDisplay(infos);
    return infos;
  }

  public async loadFileInfo(path: string): Promise<string> {
    const data = await this.fsActor.readFileAsync(path, "utf8");
    return util.processFileLoadForDisplay(path, data);
  }

}

export class RenamerActorImpl implements RenamerActor {

  constructor(private fsActor: FSActor) { }

  public async sendGo(): Promise<void> {
    this.fsActor.renameAsync(
      path.join("testdata", "file.txt"),
      path.join("testdata", "file2.txt"));
  }
}





class File {
  constructor(public name: string, public children?: File[]) { }
}

export class FSActorMock implements FSActor {
  private contents: File = new File(".",
    [
      new File("testdata",
      [
        new File("file.txt"),
        new File("dir",
        [
          new File("another.json"),
        ]),
      ]),
    ]);

  public async readdirAsync(dir: string): Promise<string[]> {
    const file = this.getFile(dir);
    if (!file.children) {
      throw new Error("Error: ENOTDIR: not a directory");
    }
    const asStrArray = file.children.map((f) => f.name);
    return asStrArray;
  }
  public async statAsync(f: string): Promise<fs.Stats> {
    const file = this.getFile(f);
    const stat: fs.Stats = {
      isFile()            { return !file.children; },
      isDirectory()      { return !!file.children;  },
    } as any;
    return stat;
  }
  public async readFileAsync(filename: string, _: string): Promise<string> {
    const file = this.getFile(filename);
    if (file.children) {
      throw new Error("Error: EISDIR: illegal operation on a directory");
    }
    return "filecontents";
  }

  public async renameAsync(oldPath: string, newPath: string): Promise<void> {
    const [file, parent] = this.getFileAndParent(oldPath);
    if (!parent) {
      throw new Error("Unexpected error!");
    }
    const newPathObj = path.parse(newPath);
    const destDir = this.getFile(newPathObj.dir);
    if (!destDir.children) {
      throw new Error("ENOENT destination directory does not exist.");
    }
    const i = parent.children!.findIndex((f) => f.name === file.name);
    assert(i >= 0);
    parent.children!.splice(i, 1);
    destDir.children.push(file);
    file.name = newPathObj.base;
  }

  private getFile(dir: string): File {
    return this.getFileAndParent(dir)[0];
  }

  private getFileAndParent(dir: string): [File, File | undefined] {
    const parts = path.normalize(dir).split(path.sep);
    let parent: File | undefined = undefined;
    let loc = this.contents;
    for (const part of parts) {
      if (part.length === 0) { break; }
      if (!loc.children) {
        // current file has no children.
        throw new Error("ENOENT: no such file or directory: " + dir);
      }
      const temp = loc.children.find((f) => f.name === part);
      if (!temp) {
        // children does not contain the file we are looking for.
        throw new Error("ENOENT: no such file or directory: " + dir);
      }
      parent = loc;
      loc = temp;
    }
    return [loc, parent];
  }

}
