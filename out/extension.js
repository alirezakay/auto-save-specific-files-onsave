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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const fs_1 = __importDefault(require("fs"));
const path_1 = require("path");
const vscode = __importStar(require("vscode"));
async function touchFile(filePath, when) {
    const config = vscode.workspace.getConfiguration('autoSaveOnSave');
    const touchFiles = config.get('touchFiles') || "never";
    if (touchFiles !== "never" && when === touchFiles) {
        const uri = vscode.Uri.file(filePath);
        await vscode.workspace.fs.writeFile(uri, await vscode.workspace.fs.readFile(uri));
    }
}
async function closeEditorByUri(uri) {
    const editor = vscode.window.visibleTextEditors.find((editor) => editor.document.uri.toString() === uri.toString());
    if (editor) {
        await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
    }
}
function isWritable(filePath) {
    try {
        fs_1.default.accessSync(filePath, fs_1.default.constants.W_OK);
        return true; // Writable
    }
    catch (err) {
        return false; // Not writable or locked by another process
    }
}
function isFileLocked(filePath) {
    try {
        const fileDescriptor = fs_1.default.openSync(filePath, 'r+'); // Try opening in read-write mode
        fs_1.default.closeSync(fileDescriptor); // Close immediately if successful
        return false; // Not locked
    }
    catch (err) {
        if (err.code === 'EBUSY' || err.code === 'EACCES' || err.code === 'EPERM') {
            return true; // File is locked by another process
        }
        throw err; // Other errors
    }
}
async function makeFileDirty(filePath) {
    const config = vscode.workspace.getConfiguration('autoSaveOnSave');
    const makeFilesDirtyOnSave = config.get('makeFilesDirtyOnSave');
    if (makeFilesDirtyOnSave) {
        const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
        while (isFileLocked(filePath)) {
            await delay(25);
        }
        const fsContent = fs_1.default.readFileSync(filePath);
        // const fsText = fsContent.toString().trim();
        // const document = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
        const es = vscode.window.tabGroups.activeTabGroup.tabs;
        const curr = vscode.window.activeTextEditor;
        const edit = new vscode.WorkspaceEdit();
        edit.createFile(vscode.Uri.file(filePath), {
            contents: fsContent,
            overwrite: true,
            ignoreIfExists: false
        });
        await vscode.workspace.applyEdit(edit);
        vscode.workspace.save(vscode.Uri.file(filePath));
        // @ts-ignore
        if (!(es.map(e => e.input ? e.input.uri.fsPath : null).includes(vscode.Uri.file(filePath).fsPath))) {
            const uri = vscode.Uri.file(filePath);
            await closeEditorByUri(uri);
        }
        else {
            if (curr?.document) {
                // await vscode.window.showTextDocument(curr.document, { preview: false, preserveFocus: true, viewColumn: vscode.ViewColumn.Active });
            }
        }
        return true;
    }
    return false;
}
async function saveFilesMatchingPattern(context, sourcePath, filePath, globPattern) {
    try {
        const config = vscode.workspace.getConfiguration('autoSaveOnSave');
        const onlyDirtyFiles = config.get('onlyDirtyFiles');
        const delay = config.get('delay') || 0;
        const times = config.get('times') || 1;
        const restartLnaguageServer = config.get('restartLnaguageServer') || [];
        const showAlerts = config.get('showAlerts');
        const do_save = async () => {
            // Find files that match the glob pattern in the workspace
            const files = (await vscode.workspace.findFiles(globPattern));
            const len = files.length;
            if (len === 0) {
                vscode.window.showInformationMessage(`No files found matching pattern: ${globPattern}`);
                return;
            }
            // Loop through matched files and save each if it has unsaved changes
            let nlen = 0;
            let f = vscode.Uri.prototype;
            for (const file of files) {
                // @ts-ignore
                let document = undefined;
                try {
                    document = await vscode.workspace.openTextDocument(file);
                    if (document.uri.fsPath === sourcePath) {
                        continue;
                    }
                }
                catch {
                    continue;
                }
                if (document.isDirty || !onlyDirtyFiles) {
                    await touchFile(document.uri.fsPath, "before");
                    if (!(await makeFileDirty(document.uri.fsPath))) {
                        await document.save();
                    }
                    await touchFile(document.uri.fsPath, "after");
                    if (times > 1) {
                        let counter = 1;
                        const interval = setInterval(async () => {
                            await touchFile(document.uri.fsPath, "before");
                            if (!(await makeFileDirty(document.uri.fsPath))) {
                                await document.save();
                            }
                            await touchFile(document.uri.fsPath, "after");
                            counter++;
                            if (counter >= times) {
                                clearInterval(interval);
                            }
                        }, 25);
                    }
                    if (nlen === 0) {
                        f = file;
                    }
                    nlen++;
                }
            }
            if (showAlerts) {
                if (nlen === 1) {
                    vscode.window.showInformationMessage(`Saved file: ${f.fsPath}`);
                }
                else if (nlen > 1) {
                    vscode.window.showInformationMessage(`Saved all ${nlen} unsaved files with ${globPattern} pattern`);
                }
            }
            if (restartLnaguageServer && restartLnaguageServer.length) {
                for (const ls of restartLnaguageServer) {
                    if (typeof ls === 'string') {
                        await vscode.commands.executeCommand(ls);
                    }
                }
            }
        };
        try {
            if (delay > 0) {
                setTimeout(async () => {
                    try {
                        await do_save();
                    }
                    catch (error) {
                        console.error(`[Error]3 saving files matching pattern ${globPattern}:`, error);
                        vscode.window.showErrorMessage(`Failed to save files matching pattern ${globPattern}`);
                    }
                    finally {
                        context.globalState.update("lock", false);
                    }
                }, delay);
            }
            else {
                await do_save();
                context.globalState.update("lock", false);
                const lock = context.globalState.get("lock");
            }
        }
        catch (error) {
            context.globalState.update("lock", false);
            console.error(`[Error]2 saving files matching pattern ${globPattern}:`, error);
            vscode.window.showErrorMessage(`Failed to save files matching pattern ${globPattern}`);
        }
    }
    catch (error) {
        context.globalState.update("lock", false);
        console.error(`[Error]1 saving files matching pattern ${globPattern}:`, error);
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
    context.globalState.update("lock", false);
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
        const path = filePath ? filePath : "**/*";
        const config = vscode.workspace.getConfiguration('autoSaveOnSave');
        const watchPath = config.get('watchPath') || "";
        const lock = context.globalState.get("lock");
        if (!lock && path && document.uri.scheme === "file") {
            const sourcePath = document.uri.fsPath;
            context.globalState.update("lock", true);
            const docPath = document.uri.fsPath;
            if (watchPath) {
                const m = (0, path_1.matchesGlob)(docPath, watchPath);
                if (m) {
                    await saveFilesMatchingPattern(context, sourcePath, filePath, path);
                }
                else {
                    context.globalState.update("lock", false);
                }
            }
            else {
                await saveFilesMatchingPattern(context, sourcePath, filePath, path);
            }
        }
        else if (lock) {
            vscode.window.showErrorMessage(`LOCKED! Failed to save files matching pattern ${filePath}`);
        }
    });
}
function deactivate() { }
//# sourceMappingURL=extension.js.map