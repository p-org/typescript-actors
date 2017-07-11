import * as path from "path";

export interface PathInfoDisplayRecord { isfile: boolean; elemid: string; shortname: string; encodedname: string; }

// New util functions
export function withinPath(path: string, belowPath: string): boolean {
  const fullpath = canonicalPath(path, belowPath);
  return (fullpath.length > path.length) && (fullpath.substr(0, path.length) === path);
}

export function zip<A, B>(arr1: A[], arr2: B[]): Array<[A, B]> {
  const res: Array<[A, B]> = [];
  const size = Math.min(arr1.length, arr2.length);
  for (let i = 0; i < size; ++i) {
    res.push([arr1[i], arr2[i]]);
  }
  return res;
}

// Old util functions

export function processForDisplay(info: PathInfoDisplayRecord[]) {
  info.sort((a, b) => {
    if (a.isfile !== b.isfile) {
      return a.isfile ? 1 : -1;
    } else {
      return a.shortname.localeCompare(b.shortname);
    }
  });
}

export function canonicalPath(...args: string[]): string {
  return path.normalize(path.join(...args));
}

export function htmlEncodeContent(unsafeStr: string): string {
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

export function processFileLoadForDisplay(file: string, data: string): string {
  let output = "";

  if (data === "") {
    output = `<em>The file '${path.basename(file)}' is empty!</em>`;
  } else if (path.extname(file) === ".js" || path.extname(file) === ".html") {
    const htmlstr = htmlEncodeContent(data.toString());
    output = `<code>${htmlstr}</code>`;
  } else if (path.extname(file) === ".txt" || path.extname(file) === ".log") {
    const htmlstr = htmlEncodeContent(data.toString());
    output = `<div class="plaintext">${htmlstr}</div>`;
  } else {
    output = `<em>Cannot display the content of '${path.basename(file)}'.</em>`;
  }

  return output;
}

