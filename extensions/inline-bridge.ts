/**
 * Inline bridge: `/watch` turns this pi session into the watched session for
 * the current repo. The pi-inline VS Code extension finds it via a port file
 * keyed by cwd and POSTs messages here, which are injected as if typed.
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import * as http from "http";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const PORT_DIR = path.join(os.homedir(), ".pi", "agent", "bridge");

function portFile(cwd: string) {
	return path.join(PORT_DIR, Buffer.from(cwd).toString("base64url") + ".json");
}

export default function (pi: ExtensionAPI) {
	let server: http.Server | undefined;
	let cwd = process.cwd();

	function start(ctx: any) {
		if (server) {
			ctx.ui.notify(`Already watching ${cwd} on port ${(server.address() as any)?.port}`, "info");
			return;
		}
		fs.mkdirSync(PORT_DIR, { recursive: true });
		server = http.createServer((req, res) => {
			if (req.method !== "POST") {
				res.writeHead(405).end();
				return;
			}
			let body = "";
			req.on("data", (chunk: string) => (body += chunk));
			req.on("end", async () => {
				try {
					const { message } = JSON.parse(body);
					if (typeof message !== "string" || !message) throw new Error("no message");
					try {
						await pi.sendUserMessage(message);
					} catch {
						// busy streaming - queue as steer
						await pi.sendUserMessage(message, { deliverAs: "steer" });
					}
					res.writeHead(200).end("ok");
				} catch (e: any) {
					res.writeHead(400).end(e.message);
				}
			});
		});
		server.listen(0, "127.0.0.1", () => {
			const port = (server!.address() as any).port;
			fs.writeFileSync(portFile(cwd), JSON.stringify({ port, pid: process.pid }));
			ctx.ui.notify(`Watching ${cwd} on :${port}`, "info");
		});
	}

	pi.registerCommand("watch", {
		description: "Watch this repo: accept inline edits from the pi-inline VS Code extension",
		handler: async (_args, ctx) => start(ctx),
	});

	pi.on("session_shutdown", async () => {
		if (server) {
			server.close();
			fs.rmSync(portFile(cwd), { force: true });
		}
	});
}
