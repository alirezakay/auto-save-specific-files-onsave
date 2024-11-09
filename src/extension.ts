import { join, matchesGlob } from 'path';
import * as vscode from 'vscode';

async function saveFilesMatchingPattern(rootPath: string, filePath: string, globPattern: string) {
    try {
        // Find files that match the glob pattern in the workspace
        const files = await vscode.workspace.findFiles(globPattern);
        const len = files.length;
        if (len === 0) {
            vscode.window.showInformationMessage(`No files found matching pattern: ${globPattern}`);
            return;
        }

        const config = vscode.workspace.getConfiguration('autoSaveOnSave');
        const onlyDirtyFiles = config.get<boolean>('onlyDirtyFiles');
        const delay = config.get<number>('delay') || 0;

        const do_save = async () => {
            // Loop through matched files and save each if it has unsaved changes
            let nlen = 0;
            let f = vscode.Uri.prototype;
            for (const file of files) {
                const document = await vscode.workspace.openTextDocument(file);
                if (document.isDirty ||  !onlyDirtyFiles) {
                    await document.save();
                    if (nlen===0){
                        f = file;
                    }
                    nlen ++;
                }
            }
            if (nlen===1){
                vscode.window.showInformationMessage(`Saved file: ${f.fsPath}`);
            }
            else if(nlen>1){
                vscode.window.showInformationMessage(`Saved all ${nlen} unsaved files in ${rootPath} with ${filePath} pattern`);
            }
        };

        if (delay>0){
            setTimeout(async () => {
                await do_save();
            }, delay);
        }
        else {
            await do_save();
        }
    } 
    catch (error) {
        console.error(`Error saving files matching pattern ${globPattern}:`, error);
        vscode.window.showErrorMessage(`Failed to save files matching pattern ${globPattern}`);
    }
}

function getRootFolderPath(): string | undefined {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
        return workspaceFolders[0].uri.fsPath;
    }
    return undefined;
}

function getFilePathSetting(): string {
    const config = vscode.workspace.getConfiguration('autoSaveOnSave');
    const filePath = config.get<string>('filePath');
    return filePath || '';
}

export function activate(context: vscode.ExtensionContext) {
	let disposable = vscode.commands.registerCommand('extension.saveAllFiles', async () => {
        // Save all open files
        await vscode.workspace.saveAll();
    });
    context.subscriptions.push(disposable);
	
	vscode.workspace.onDidSaveTextDocument(async (document: vscode.TextDocument) => {        
		const rootPath = getRootFolderPath();
		if (!rootPath) {
			vscode.window.showErrorMessage("No root folder is open in the workspace.");
			return;
		}
        const filePath = getFilePathSetting();
		const path = join(rootPath, filePath)?filePath:null;

        const config = vscode.workspace.getConfiguration('autoSaveOnSave');
        const watchPath = config.get<string>('watchPath') || "";

		if (path && document.uri.scheme === "file") {
            const docPath = document.uri.fsPath;
            if (watchPath){
                const m = matchesGlob(docPath, watchPath);
                if (m){
                    await saveFilesMatchingPattern(rootPath, filePath, path);
                }
            }
            else{
                await saveFilesMatchingPattern(rootPath, filePath, path);
            }
		}
	});
}

export function deactivate() {}
