import { join, matchesGlob } from 'path';
import * as vscode from 'vscode';

let lock = false;

async function touchFile(filePath: string, when: string) {
    const config = vscode.workspace.getConfiguration('autoSaveOnSave');
    const touchFiles = config.get<string>('touchFiles') || "never";

    if (touchFiles!=="never" && when===touchFiles){
        const uri = vscode.Uri.file(filePath);
        await vscode.workspace.fs.writeFile(uri, await vscode.workspace.fs.readFile(uri));        
    }
}

async function closeEditorByUri(uri: vscode.Uri) {
    const editor = vscode.window.visibleTextEditors.find(
        (editor) => editor.document.uri.toString() === uri.toString()
    );
    if (editor) {
        await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
    }
}

async function makeFileDirty(filePath: string): Promise<boolean> {
    const config = vscode.workspace.getConfiguration('autoSaveOnSave');
    const makeFilesDirtyOnSave = config.get<boolean>('makeFilesDirtyOnSave');
    

    if (makeFilesDirtyOnSave){
        const document = await vscode.workspace.openTextDocument(filePath);
        const es = vscode.window.tabGroups.activeTabGroup.tabs;
        const curr = vscode.window.activeTextEditor;
        const editor = await vscode.window.showTextDocument(document, { preview: false, preserveFocus: true, viewColumn: vscode.ViewColumn.Active });
        
        await editor.edit(editBuilder => {
            const position = new vscode.Position(0, 0);
            editBuilder.insert(position, "\u200B"); // Zero-width space
        });
    
        await editor.edit(editBuilder => {
            editBuilder.delete(new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 1)));
        });

        await editor.document.save();

        // @ts-ignore
        if (!(es.map(e => e.input.uri.fsPath).includes(document.uri.fsPath))){
            const uri = vscode.Uri.file(filePath);
            await closeEditorByUri(uri);
        }
        else{
            if (curr?.document){                
                await vscode.window.showTextDocument(curr.document, { preview: false, preserveFocus: true, viewColumn: vscode.ViewColumn.Active });
            }
        }
        return true;
    }
    return false;
}

async function saveFilesMatchingPattern(rootPath: string, filePath: string, globPattern: string) {
    try {
        // Find files that match the glob pattern in the workspace
        const files = (await vscode.workspace.findFiles(globPattern));
        const len = files.length;
        if (len === 0) {
            vscode.window.showInformationMessage(`No files found matching pattern: ${globPattern}`);
            return;
        }

        const config = vscode.workspace.getConfiguration('autoSaveOnSave');
        const onlyDirtyFiles = config.get<boolean>('onlyDirtyFiles');
        const delay = config.get<number>('delay') || 0;
        const times = config.get<number>('times') || 1;
        const restartLnaguageServer = config.get<Array<string>>('restartLnaguageServer') || [];
        const showAlerts = config.get<number>('showAlerts');        

        const do_save = async () => {
            // Loop through matched files and save each if it has unsaved changes
            let nlen = 0;
            let f = vscode.Uri.prototype;
            for (const file of files) {
                // @ts-ignore
                let document: vscode.TextDocument = undefined;
                try{
                    document = await vscode.workspace.openTextDocument(file);
                    if (document.uri.fsPath===vscode.Uri.file(filePath).fsPath){
                        continue;
                    }
                } catch{
                    continue;
                }
                if (document.isDirty ||  !onlyDirtyFiles) {
                    await touchFile(document.uri.fsPath, "before");
                    if (!(await makeFileDirty(document.uri.fsPath))){
                        await document.save();
                    }
                    await touchFile(document.uri.fsPath, "after");
                    if (times > 1){
                        let counter = 1;
                        const interval = setInterval(async () => {
                            await touchFile(document.uri.fsPath, "before");
                            if (!(await makeFileDirty(document.uri.fsPath))){
                                await document.save();
                            }
                            await touchFile(document.uri.fsPath, "after");
                            counter++;
                            if (counter>=times){
                                clearInterval(interval);
                            }
                        }, 10);
                    }
                    if (nlen===0){
                        f = file;
                    }
                    nlen ++;
                }
            }
            if (showAlerts){
                if (nlen===1){
                    vscode.window.showInformationMessage(`Saved file: ${f.fsPath}`);
                }
                else if(nlen>1){
                    vscode.window.showInformationMessage(`Saved all ${nlen} unsaved files in ${rootPath} with ${filePath} pattern`);
                }
            }
            if (restartLnaguageServer && restartLnaguageServer.length){
                for (const ls of restartLnaguageServer){
                    if (typeof ls === 'string'){
                        await vscode.commands.executeCommand(ls);
                    }
                }
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
		const path = filePath?filePath:"**/*";
        
        

        const config = vscode.workspace.getConfiguration('autoSaveOnSave');
        const watchPath = config.get<string>('watchPath') || "";

		if (!lock && path && document.uri.scheme === "file") {
            lock = true;
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
            lock = false;
		}
	});
}

export function deactivate() {}
