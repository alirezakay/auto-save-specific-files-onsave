import fs from "fs";
import { join, matchesGlob } from 'path';
import * as vscode from 'vscode';

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

function isWritable(filePath: string): boolean {
    try {
        fs.accessSync(filePath, fs.constants.W_OK);
        return true; // Writable
    } catch (err) {
        return false; // Not writable or locked by another process
    }
}

function isFileLocked(filePath: string): boolean {
    try {
        const fileDescriptor = fs.openSync(filePath, 'r+'); // Try opening in read-write mode
        fs.closeSync(fileDescriptor); // Close immediately if successful
        return false; // Not locked
    } catch (err: Error|any) {
        if (err.code === 'EBUSY' || err.code === 'EACCES' || err.code === 'EPERM') {
            return true; // File is locked by another process
        }
        throw err; // Other errors
    }
}

async function makeFileDirty(filePath: string): Promise<boolean> {
    const config = vscode.workspace.getConfiguration('autoSaveOnSave');
    const makeFilesDirtyOnSave = config.get<boolean>('makeFilesDirtyOnSave');

    if (makeFilesDirtyOnSave){
        const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
        while (isFileLocked(filePath)){
            await delay(25);
        }
        const fsContent = fs.readFileSync(filePath);
        // const fsText = fsContent.toString().trim();
        // const document = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
        const es = vscode.window.tabGroups.activeTabGroup.tabs;
        const curr = vscode.window.activeTextEditor;

        const edit  = new vscode.WorkspaceEdit();
        edit.createFile(
            vscode.Uri.file(filePath),
            {
                contents: fsContent,
                overwrite: true,
                ignoreIfExists: false
            }
        );
        await vscode.workspace.applyEdit(edit);

        vscode.workspace.save(vscode.Uri.file(filePath));
        
        // @ts-ignore
        if (!(es.map(e => e.input?e.input.uri.fsPath:null).includes(vscode.Uri.file(filePath).fsPath))){
            const uri = vscode.Uri.file(filePath);
            await closeEditorByUri(uri);
        }
        else{
            if (curr?.document){                
                // await vscode.window.showTextDocument(curr.document, { preview: false, preserveFocus: true, viewColumn: vscode.ViewColumn.Active });
            }
        }
        return true;
    }
    return false;
}

async function saveFilesMatchingPattern(context: vscode.ExtensionContext, sourcePath: string, filePath: string, globPattern: string) {
    try {
        const config = vscode.workspace.getConfiguration('autoSaveOnSave');
        const onlyDirtyFiles = config.get<boolean>('onlyDirtyFiles');
        const delay = config.get<number>('delay') || 0;
        const times = config.get<number>('times') || 1;
        const restartLnaguageServer = config.get<Array<string>>('restartLnaguageServer') || [];
        const showAlerts = config.get<number>('showAlerts');        

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
                let document: vscode.TextDocument = undefined;
                try{
                    document = await vscode.workspace.openTextDocument(file);
                    if (document.uri.fsPath===sourcePath){
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
                        }, 25);
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
                    vscode.window.showInformationMessage(`Saved all ${nlen} unsaved files with ${globPattern} pattern`);
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
        try{
            if (delay>0){
                setTimeout(async () => {
                    try{
                        await do_save();
                    }
                    catch (error){
                        console.error(`[Error]3 saving files matching pattern ${globPattern}:`, error);
                        vscode.window.showErrorMessage(`Failed to save files matching pattern ${globPattern}`);
                    }
                    finally{
                        context.globalState.update("lock", false);
                    }
                }, delay);
            }
            else {
                await do_save();
                context.globalState.update("lock", false);
                const lock = context.globalState.get("lock");
                
            }
        } catch(error) {
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
    context.globalState.update("lock", false);
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

        const lock = context.globalState.get("lock");
		if (!lock && path && document.uri.scheme === "file") {
            const sourcePath = document.uri.fsPath;
            context.globalState.update("lock", true);
            const docPath = document.uri.fsPath;
            
            if (watchPath){
                const m = matchesGlob(docPath, watchPath);
                if (m){
                    await saveFilesMatchingPattern(context, sourcePath, filePath, path);
                }
                else{
                    context.globalState.update("lock", false);
                }
            }
            else{
                await saveFilesMatchingPattern(context, sourcePath, filePath, path);
            }
		}
        else if(lock){
            vscode.window.showErrorMessage(`LOCKED! Failed to save files matching pattern ${filePath}`);
        }
	});
}

export function deactivate() {}
