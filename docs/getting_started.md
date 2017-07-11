# Getting started

## Clone repo

This repo uses symlinks. On Windows, you will need an up-to-date version of Git for Windows.

**From an Administrator Command Prompt**:

```cmd
git clone -c core.symlinks=true git@github.com:p-org/typescript-actors.git
```

You can then close the admin command prompt.

## Installing `npm` on Windows

Install `nvm-windows` and then:

```cmd
nvm list available
nvm install X.X.X
nvm use X.X.X

npm install npm-windows-upgrade -g
```

Under admin cmd:

```cmd
npm-windows-upgrade
```

## Install `lerna`

`lerna` is used to handle multiple projects in the same repo.

```cmd
npm install --global lerna
```

## Bootstrap the project

From the repo root:

```cmd
lerna bootstrap
```

This executes `npm install` in each package directory to download all npm modules for every project, but uses symlinks to add dependencies that exist in this repo. E.g. `packages/async-actors-example` depends on `packages/async-actors`.
> Note that `lerna` will temporarily rename your `package.json` files during this process.

 ## Build

Build all projects:

```cmd
lerna exec npm run build --concurrency 1
``` 

## Examples

```cmd
cd packages/async-actors-example
node lib\examples.js
```


