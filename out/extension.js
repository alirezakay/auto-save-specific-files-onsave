"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const path_1 = require("path");
const vscode = __importStar(require("vscode"));
async function saveFilesMatchingPattern(rootPath, filePath, globPattern) {
    try {
        // Find files that match the glob pattern in the workspace
        const files = await vscode.workspace.findFiles(globPattern);
        const len = files.length;
        if (len === 0) {
            vscode.window.showInformationMessage(`No files found matching pattern: ${globPattern}`);
            return;
        }
        const config = vscode.workspace.getConfiguration('autoSaveOnSave');
        const onlyDirtyFiles = config.get('onlyDirtyFiles');
        // Loop through matched files and save each if it has unsaved changes
        let nlen = 0;
        let f = vscode.Uri.prototype;
        for (const file of files) {
            const document = await vscode.workspace.openTextDocument(file);
            if (document.isDirty || !onlyDirtyFiles) {
                await document.save();
                if (nlen === 0) {
                    f = file;
                }
                nlen++;
            }
        }
        if (nlen === 1) {
            vscode.window.showInformationMessage(`Saved file: ${f.fsPath}`);
        }
        else if (nlen > 1) {
            vscode.window.showInformationMessage(`Saved all ${nlen} unsaved files in ${rootPath} with ${filePath} pattern`);
        }
    }
    catch (error) {
        console.error(`Error saving files matching pattern ${globPattern}:`, error);
        vscode.window.showErrorMessage(`Failed to save files matching pattern ${globPattern}`);
    }
}
function getRootFolderPath() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
        return workspaceFolders[0].uri.fsPath;
    }
    return undefined;
}
function getFilePathSetting() {
    const config = vscode.workspace.getConfiguration('autoSaveOnSave');
    const filePath = config.get('filePath');
    return filePath || '';
}
function activate(context) {
    let disposable = vscode.commands.registerCommand('extension.saveAllFiles', async () => {
        // Save all open files
        await vscode.workspace.saveAll();
    });
    context.subscriptions.push(disposable);
    vscode.workspace.onDidSaveTextDocument(async (document) => {
        const rootPath = getRootFolderPath();
        if (!rootPath) {
            vscode.window.showErrorMessage("No root folder is open in the workspace.");
            return;
        }
        const filePath = getFilePathSetting();
        const path = (0, path_1.join)(rootPath, filePath) ? filePath : null;
        if (path && document.uri.scheme === "file") {
            await saveFilesMatchingPattern(rootPath, filePath, path);
        }
    });
}
function deactivate() { }
//# sourceMappingURL=extension.js.map