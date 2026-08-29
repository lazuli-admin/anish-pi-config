import * as vscode from "vscode";
import * as http from "http";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

function portFile(cwd: string) {
	return path.join(os.homedir(), ".pi", "agent", "bridge", Buffer.from(cwd).toString("base64url") + ".json");
}

function send(cwd: string, message: string): Promise<void> {
	return new Promise((resolve, reject) => {
		let port: number;
		try {
			port = JSON.parse(fs.readFileSync(portFile(cwd), "utf8")).port;
		} catch {
			return reject(new Error(`No watched pi session for this repo. Run /watch in a pi session at ${cwd}`));
		}
		const req = http.request(
			{ host: "127.0.0.1", port, method: "POST", path: "/" },
			(res) => (res.statusCode === 200 ? resolve() : reject(new Error(`bridge: ${res.statusCode}`)))
		);
		req.on("error", () =>
			reject(new Error(`Watched pi session (port ${port}) not responding. Run /watch in a pi session at ${cwd}`))
		);
		req.end(JSON.stringify({ message }));
	});
}

export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(
		vscode.commands.registerCommand("piInline.send", async () => {
			const editor = vscode.window.activeTextEditor;
			if (!editor) return;

			const instruction = await vscode.window.showInputBox({
				placeHolder: "What should pi do with the selection?",
			});
			if (!instruction) return;

			const sel = editor.selection;
			const code = editor.document.getText(sel.isEmpty ? undefined : sel);
			const range = sel.isEmpty ? "the whole file" : `lines ${sel.start.line + 1}-${sel.end.line + 1}`;
			const relPath = vscode.workspace.asRelativePath(editor.document.uri);
			const cwd = vscode.workspace.getWorkspaceFolder(editor.document.uri)?.uri.fsPath ?? process.cwd();

			const message = [
				instruction,
				"",
				`Context: \`${relPath}\` in \`${cwd}\` (${range}):`,
				"```",
				code,
				"```",
				"Scope: only the selection above - never modify anything else. If the message is a question or comment, just respond; if it asks for a change, apply it to this selection only.",
			].join("\n");

			try {
				await send(cwd, message);
				vscode.window.showInformationMessage("pi: sent to session");
			} catch (e: any) {
				vscode.window.showErrorMessage(`pi: ${e.message}`);
			}
		})
	);
}
