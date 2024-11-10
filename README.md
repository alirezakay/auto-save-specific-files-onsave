# Auto Save Specific Files on Save

Automatically saves specific unsaved-files in your workspace whenever any files are saved. Define target files or file patterns (e.g., `.txt` files) in your settings for automatic saving.

## Features

- **Auto-save specific files** based on user-defined patterns.
- **Customizable file path setting** for specifying files to save automatically.
- Works seamlessly in the background, reducing manual save operations for specific files.

## Requirements

- Requires TypeScript installed in the project (`npm install typescript --save-dev`) for development.
- `vsce` for packaging and publishing the extension (`npm install -g vsce`).

## Extension Settings

This extension adds the following setting in VS Code:

- `autoSaveOnSave.filePath`: Specify the file path or pattern to save automatically when modified (e.g., `"**/*.txt"` to target all `.txt` files in the workspace).

- `autoSaveOnSave.onlyDirtyFiles`: Specify if just the dirty (unsaved) files should be saved or not! Sometimes you might need the undirty files to be saved again in some cases.

- `autoSaveOnSave.delay`: Determine if the specified files should be saved with a delay. Its value is an integer specifying the delay time in milliseconds.

- `autoSaveOnSave.watchPath`: Specify on which path the saving action should be watched in order that the intended files be saved. i.e. what files should be saved in order to the desired files be saved as well! The default value is the whole path in the workspace. 

- `autoSaveOnSave.times`: Specify how many times the intended files should be saved! Actually this option may help in some rare cases!!!

- `autoSaveOnSave.restartLnaguageServer`: Specify the restart `commands` for the language servers you want to be restarded after the saving action. e.g. ['typescript.restartTsServer', 'python.analysis.restartLanguageServer'].

- `autoSaveOnSave.showAlerts`: Whether to show the message alert pop-ups in vscode or not.

- `autoSaveOnSave.touchFiles`: Whether to touch the desired files before or after saving. Default value is none.

- `autoSaveOnSave.makeFilesDirtyOnSave`: Whether to make the desired files dirty before or after saving. Default value is none.


To configure, open **Settings** (`Ctrl + ,` or `Cmd + ,` on macOS), search for `Auto Save Specific Files OnSave`, and set your preferred path or file pattern.

## Usage

1. Define the file path or pattern in settings (`autoSaveOnSave.filePath`).
2. Any time you save a file in the workspace, every files that matches your pattern, will automatically get saved.

## Known Issues

- Files outside the workspace cannot be saved automatically due to workspace limitations.
- Reload may be required to recognize changes to the file path setting.

## Release Notes

### 0.1.7

- Initial release with support for automatic save on specific files.

---

**Enjoy using Auto Save Specific Files on Save!**
