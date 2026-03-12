#!/usr/bin/env node

import { access, chmod, cp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const targetRoot = path.join(projectRoot, "src-tauri", "runtime", "openclaw");
const markerPath = path.join(targetRoot, ".runtime-source.json");
const requiredEntries = ["openclaw.mjs", "dist"];
const optionalEntries = [
	"package.json",
	"node_modules",
	"assets",
	"extensions",
	"skills",
	"docs",
	"LICENSE",
	"README.md",
	"CHANGELOG.md",
];

function resolveCandidate(p) {
	if (!p) {
		return null;
	}
	return path.isAbsolute(p) ? p : path.resolve(projectRoot, p);
}

function safeExec(program, args) {
	try {
		return execFileSync(program, args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })
			.trim()
			.split(/\r?\n/)
			.map((line) => line.trim())
			.filter(Boolean);
	} catch {
		return [];
	}
}

function discoverSystemRuntimeCandidates() {
	const results = [];
	if (process.platform === "win32") {
		for (const cmdPath of safeExec("where", ["openclaw.cmd"])) {
			const cliDir = path.dirname(cmdPath);
			results.push(path.join(cliDir, "openclaw"));
			results.push(path.join(cliDir, "..", "openclaw"));
		}
		const appData = process.env.APPDATA;
		if (appData) {
			results.push(path.join(appData, "npm", "node_modules", "openclaw"));
			results.push(path.join(appData, "npm", "node_modules", "@openclaw", "openclaw"));
		}
	} else {
		for (const cmdPath of safeExec("which", ["openclaw"])) {
			const cliDir = path.dirname(cmdPath);
			results.push(path.join(cliDir, "..", "lib", "node_modules", "openclaw"));
		}
	}
	return results;
}

async function exists(p) {
	try {
		await access(p);
		return true;
	} catch {
		return false;
	}
}

async function runtimeLooksUsable(dir) {
	if (!(await exists(dir))) {
		return false;
	}
	const entry = path.join(dir, "openclaw.mjs");
	const distEntryJs = path.join(dir, "dist", "entry.js");
	const distEntryMjs = path.join(dir, "dist", "entry.mjs");
	return (await exists(entry)) && ((await exists(distEntryJs)) || (await exists(distEntryMjs)));
}

async function ensureCleanTarget() {
	await rm(targetRoot, { recursive: true, force: true });
	await mkdir(targetRoot, { recursive: true });
	await writeFile(path.join(targetRoot, ".gitkeep"), "", "utf8");
}

async function copyEntry(sourceRoot, relPath) {
	const src = path.join(sourceRoot, relPath);
	if (!(await exists(src))) {
		return false;
	}
	const dst = path.join(targetRoot, relPath);
	await cp(src, dst, { recursive: true, force: true });
	return true;
}

async function embedNodeBinary() {
	const nodeSrc = process.execPath;
	if (!(await exists(nodeSrc))) {
		return;
	}
	if (process.platform === "win32") {
		const nodeDst = path.join(targetRoot, "node", "node.exe");
		await mkdir(path.dirname(nodeDst), { recursive: true });
		await cp(nodeSrc, nodeDst, { force: true });
		return;
	}
	const nodeDst = path.join(targetRoot, "node", "bin", "node");
	await mkdir(path.dirname(nodeDst), { recursive: true });
	await cp(nodeSrc, nodeDst, { force: true });
	await chmod(nodeDst, 0o755);
}

async function loadExistingMarker() {
	try {
		const raw = await readFile(markerPath, "utf8");
		return JSON.parse(raw);
	} catch {
		return null;
	}
}

async function writeMarker(sourceRoot) {
	const srcStat = await stat(sourceRoot);
	const payload = {
		sourceRoot,
		preparedAt: new Date().toISOString(),
		sourceMtimeMs: srcStat.mtimeMs,
		nodeBinary: process.execPath,
		platform: process.platform,
	};
	await writeFile(markerPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function maybeSkipIfFresh(sourceRoot) {
	const marker = await loadExistingMarker();
	if (!marker) {
		return false;
	}
	if (marker.sourceRoot !== sourceRoot) {
		return false;
	}
	const srcStat = await stat(sourceRoot);
	if (Math.floor(marker.sourceMtimeMs) !== Math.floor(srcStat.mtimeMs)) {
		return false;
	}
	return runtimeLooksUsable(targetRoot);
}

async function main() {
	const cleanOnly = process.argv.includes("--clean");
	if (cleanOnly) {
		await ensureCleanTarget();
		await writeFile(path.join(targetRoot, ".gitkeep"), "", "utf8");
		console.log(`[runtime] cleaned ${targetRoot}`);
		return;
	}

	const candidates = [
		resolveCandidate(process.env.OPENCLAW_RUNTIME_SOURCE),
		path.resolve(projectRoot, "..", "openclaw-runtime"),
		path.resolve(projectRoot, "..", "openclaw"),
		...discoverSystemRuntimeCandidates(),
	].filter(Boolean);

	let sourceRoot = null;
	for (const candidate of candidates) {
		if (await runtimeLooksUsable(candidate)) {
			sourceRoot = candidate;
			break;
		}
	}

	if (!sourceRoot) {
		throw new Error(
			[
				"No usable OpenClaw runtime source found.",
				"Expected a directory containing openclaw.mjs and dist/entry.js.",
				"Set OPENCLAW_RUNTIME_SOURCE to override source path.",
			].join(" "),
		);
	}

	if (await maybeSkipIfFresh(sourceRoot)) {
		console.log(`[runtime] unchanged, reusing ${targetRoot}`);
		return;
	}

	await ensureCleanTarget();

	for (const rel of [...requiredEntries, ...optionalEntries]) {
		await copyEntry(sourceRoot, rel);
	}

	await embedNodeBinary();

	const missing = [];
	for (const rel of requiredEntries) {
		if (!(await exists(path.join(targetRoot, rel)))) {
			missing.push(rel);
		}
	}
	if (missing.length > 0) {
		throw new Error(`[runtime] missing required files after copy: ${missing.join(", ")}`);
	}

	await writeMarker(sourceRoot);
	console.log(`[runtime] prepared from ${sourceRoot}`);
	console.log(`[runtime] target: ${targetRoot}`);
}

main().catch((err) => {
	console.error(String(err?.message || err));
	process.exitCode = 1;
});
