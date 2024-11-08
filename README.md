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

- `myExtension.filePath`: Specify the file path or pattern to save automatically when modified (e.g., `"**/*.txt"` to target all `.txt` files in the workspace).

To configure, open **Settings** (`Ctrl + ,` or `Cmd + ,` on macOS), search for `Auto Save Specific Files OnSave`, and set your preferred path or file pattern.

## Usage

1. Define the file path or pattern in settings (`myExtension.filePath`).
2. Any time you save a file in the workspace, every files that matches your pattern, will automatically get saved.

## Known Issues

- Files outside the workspace cannot be saved automatically due to workspace limitations.
- Reload may be required to recognize changes to the file path setting.

## Release Notes

### 1.0.0

- Initial release with support for automatic save on specific files.

---

**Enjoy using Auto Save Specific Files on Save!**
