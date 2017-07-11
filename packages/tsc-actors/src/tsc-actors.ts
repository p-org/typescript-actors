
import * as ts from "typescript";

function getBaseTypesRecursive(type: ts.Type) {
  const result = new Set<ts.Type>();
  getBaseTypesRecursiveHelper(type, result);
  return result;

  function getBaseTypesRecursiveHelper(t: ts.Type, res: Set<ts.Type>): void {
    const baseTypes = t.getBaseTypes();
    for (const bt of baseTypes) {
      res.add(bt);
      getBaseTypesRecursiveHelper(bt, res);
    }
  }
}

function isTypedActor(type: ts.Type) {
  for (const t of Array.from(getBaseTypesRecursive(type))) {
    if (t.getSymbol().getName() === "TypedActor") {
      return true;
    }
  }
  return false;
}

class TscActors {

  private checker: ts.TypeChecker;
  private typedActors: Set<ts.Symbol>;

  public visit(node: ts.Node) {
    if (node.kind === ts.SyntaxKind.InterfaceDeclaration) {
      const symbol = this.checker.getSymbolAtLocation((node as ts.InterfaceDeclaration).name);
      const type = this.checker.getDeclaredTypeOfSymbol(symbol);

      if (isTypedActor(type)) {
        this.typedActors.add(symbol);
      }
      // console.log(temp);
    }

    ts.forEachChild(node, this.visit.bind(this));
  }

  public generate() {
    const argv = process.argv.slice(2);
    console.log(argv);
    const readFile = ts.sys.readFile;
    const exists = ts.sys.fileExists;

    const parseConfigHost: ts.ParseConfigHost = {
      fileExists: ts.sys.fileExists,
      readDirectory: ts.sys.readDirectory,
      readFile: ts.sys.readFile,
      useCaseSensitiveFileNames: ts.sys.useCaseSensitiveFileNames,
    };
    let cl = ts.parseCommandLine(argv, readFile);
    console.log(cl.options.project);

    if (!cl.options.project) {
      cl.options.project = ".";
    }

    const configFilePath = ts.findConfigFile(cl.options.project, exists);
    console.log(configFilePath);
    if (cl.fileNames.length === 0 && exists(configFilePath)) {
      const configJSON = ts.readConfigFile(configFilePath, readFile);
      if (configJSON.error) {
        console.log(configJSON.error);
        return;
      }
      cl = ts.parseJsonConfigFileContent(configJSON.config, parseConfigHost, cl.options.project, cl.options);
    }

    console.log(cl.fileNames);

    const prog = ts.createProgram(cl.fileNames, cl.options);
    this.checker = prog.getTypeChecker();
    this.typedActors = new Set<ts.Symbol>();

    for (const sourceFile of prog.getSourceFiles()) {
      if (!sourceFile.isDeclarationFile) {
        console.log(sourceFile.fileName);
        ts.forEachChild(sourceFile, this.visit.bind(this));
      }
    }

    this.processTypedActors();

  }

  private processTypedActors() {

    const tab = "  ";
    let indent = 0;
    let out = "";

    function o(...strings: string[]) {
      out = out.concat(...strings);
    }

    function newline() {
      o("\n");

    }

    function oindent() {
      o(tab.repeat(indent));
    }

    o("import ...;");
    newline();
    newline();

    for (const a of Array.from(this.typedActors)) {

      oindent();
      o(`export class ${a.getName()}Proxy implements ${a.getName()} {`);
      indent += 1;
      newline();

      const type = this.checker.getDeclaredTypeOfSymbol(a);
      const props = this.checker.getPropertiesOfType(type);
      const propDecls: ts.Declaration[] = props.map((p) => p.valueDeclaration) as ts.Declaration[];
      const signatureDecls =
        propDecls.filter((s) => s.kind === ts.SyntaxKind.MethodSignature) as ts.MethodDeclaration[];
      const signatures = signatureDecls.map((s) => this.checker.getSignatureFromDeclaration(s));
      // tslint:disable-next-line:prefer-for-of
      for (let i = 0; i < signatures.length; ++i) {
        oindent();
        o(signatureDecls[i].name.getText());
        o("(");

        o("): ");
        o("??");
        o(";");
        newline();
      }
      indent -= 1;
      newline();
      o("}");
      newline();
    }
    console.log(out);
  }
}

new TscActors().generate();
