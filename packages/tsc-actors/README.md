# tsc-actors

This project provides the `tsc-actors` command,
which uses the TypeScript Compiler API to
parse a project and generate a "proxy class"
for every actor interface.

Currently, it does not work.
We instead use JavaScript magic (in `async-actors`) to make
a proxy class for *any* actor,
although this is probably less efficient.
