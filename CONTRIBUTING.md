# Contributing

## Installation

```sh
npm install
```

## Configuration

The repository comes with an `.env.local` file configured to work locally.

Feel free to check it out, and make a copy to `.env` in order to customize.

```sh
cp .env.local .env
```

## Generating the VSIX File

A VSIX file is a packaged extension for Visual Studio Code. It contains all the files and metadata needed to install and run the extension.

The VSIX file is need to install the extension manually or distribute it to others.

To update the extension after making code changes, you need to regenerate the VSIX file.
Run the following command in your project directory:

```sh
make vsix
```

This will build a new `.vsix` file in the directory (localstack-x.x.1.vsix).

While installing from a VSIX file is common for local development or sharing, you can also run and test the extension directly in VSCode without packaging it.
To do this, open the extension project in VSCode and press `F5` to launch a new Extension Development Host window.

## Installing the VSIX File

To install the generated VSIX file in Visual Studio Code:

1. Open the Extensions view (`Cmd+Shift+X` on macOS, `Ctrl+Shift+X` on Windows/Linux) in VSCode.
2. Click the three-dot menu in the top right.
3. Select **Install from VSIX...**.
4. Choose the `.vsix` file.

## Releasing a new version

To release a new version of the extension, you need to:

1. Create a branch using the new version as the name (e.g. `v1.3.0`)
2. Update the version in `package.json` and run `npm install`
3. Update the `CHANGELOG.md` file
4. Push the branch to GitHub
5. Create a pull request in GitHub
6. While the pull request is open, execute the `Publish Extension` workflow targetting the new branch
