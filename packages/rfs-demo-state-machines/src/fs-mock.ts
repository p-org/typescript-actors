
import * as fs from "fs-extra-promise";
import * as path from "path";

export interface FSActor {
  readdirAsync(path: string): Promise<string[]>;
  statAsync(path: string): Promise<fs.Stats>;
  readFileAsync(filename: string, encoding: string): Promise<string>;
  renameAsync(oldPath: string, newPath: string): Promise<void>;

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
    if (i < 0) {
      throw new Error("Could not find file to rename!");
    }
    parent.children!.splice(i, 1);
    destDir.children.push(file);
    file.name = newPathObj.base;
  }

  private getFile(dir: string): File {
    return this.getFileAndParent(dir)[0];
  }

  private getFileAndParent(dir: string): [File, File | undefined] {
    const parts = path.normalize(dir).split(path.sep);
    let parent: File | undefined;
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

