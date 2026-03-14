#!/usr/bin/env node
/**
 * 打包 OpenClaw Runtime CDN 分发包
 *
 * 用法:
 *   node scripts/package-runtime-cdn.mjs
 *   node scripts/package-runtime-cdn.mjs --version 1.0.0
 *   node scripts/package-runtime-cdn.mjs --platform darwin-arm64
 *   OPENCLAW_RUNTIME_SOURCE=/path/to/openclaw node scripts/package-runtime-cdn.mjs
 *
 * 输出目录: dist/runtime-cdn/
 *   ├── manifest.json
 *   ├── darwin-arm64.tar.gz
 *   ├── darwin-x64.tar.gz
 *   ├── linux-x64.tar.gz
 *   └── win-x64.tar.gz
 *
 * 将 dist/runtime-cdn/ 上传到 nginx 后，更新 manifest.json 中的 CDN 地址即可。
 */

import { createHash } from "node:crypto";
import { createWriteStream, existsSync } from "node:fs";
import { chmod, cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const outputDir = path.join(projectRoot, "dist", "runtime-cdn");
const nodeArchiveCache = path.join(outputDir, ".node-archives");

// Node.js LTS 版本，可通过环境变量覆盖
const NODE_VERSION = process.env.NODE_RELEASE_VERSION || "22.14.0";

// openclaw 打包时需要的文件清单
const OPENCLAW_FILES = [
	"openclaw.mjs",
	"dist",
	"assets",
	"extensions",
	"skills",
	"package.json",
	"LICENSE",
];

// 目标平台配置
const PLATFORMS = {
	"darwin-arm64": {
		nodeUrl: `https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-darwin-arm64.tar.gz`,
		nodePkg: `node-v${NODE_VERSION}-darwin-arm64`,
		nodeArchiveExt: "tar.gz",
		nodeBinRelPath: "bin/node", // 在 tar 包内的相对路径
		nodeDstRelPath: "node/bin/node", // 在 runtime 包内的相对路径
	},
	"darwin-x64": {
		nodeUrl: `https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-darwin-x64.tar.gz`,
		nodePkg: `node-v${NODE_VERSION}-darwin-x64`,
		nodeArchiveExt: "tar.gz",
		nodeBinRelPath: "bin/node",
		nodeDstRelPath: "node/bin/node",
	},
	"linux-x64": {
		nodeUrl: `https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.gz`,
		nodePkg: `node-v${NODE_VERSION}-linux-x64`,
		nodeArchiveExt: "tar.gz",
		nodeBinRelPath: "bin/node",
		nodeDstRelPath: "node/bin/node",
	},
	"win-x64": {
		nodeUrl: `https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-win-x64.zip`,
		nodePkg: `node-v${NODE_VERSION}-win-x64`,
		nodeArchiveExt: "zip",
		nodeBinRelPath: "node.exe",
		nodeDstRelPath: "node/node.exe",
	},
};

// ─── 工具函数 ────────────────────────────────────────────────────

function log(msg) {
	process.stdout.write(`${msg}\n`);
}

function logProgress(msg) {
	process.stdout.write(`\r  ${msg}          `);
}

async function sha256File(filePath) {
	const hash = createHash("sha256");
	hash.update(await readFile(filePath));
	return hash.digest("hex");
}

async function downloadFile(url, destPath) {
	log(`  下载 ${path.basename(url)}`);
	log(`  来源: ${url}`);

	const resp = await fetch(url);
	if (!resp.ok) {
		throw new Error(`HTTP ${resp.status} 下载失败: ${url}`);
	}

	const total = Number(resp.headers.get("content-length") || 0);
	let downloaded = 0;

	const dest = createWriteStream(destPath);
	const reader = resp.body.getReader();

	await new Promise((resolve, reject) => {
		dest.on("error", reject);
		const pump = async () => {
			try {
				while (true) {
					const { done, value } = await reader.read();
					if (done) break;
					dest.write(value);
					downloaded += value.length;
					if (total > 0) {
						const pct = Math.floor((downloaded / total) * 100);
						const dlMB = (downloaded / 1024 / 1024).toFixed(1);
						const totalMB = (total / 1024 / 1024).toFixed(1);
						logProgress(`${pct}%  ${dlMB}MB / ${totalMB}MB`);
					}
				}
				dest.end();
				process.stdout.write("\n");
				resolve();
			} catch (e) {
				reject(e);
			}
		};
		pump();
	});
}

/**
 * 从 Node.js 发行包中提取 node 二进制，放到 runtimeDir/node/bin/node（或 node/node.exe）
 */
async function extractNodeBinary(archivePath, platform, runtimeDir) {
	const config = PLATFORMS[platform];
	const dstPath = path.join(runtimeDir, config.nodeDstRelPath);
	await mkdir(path.dirname(dstPath), { recursive: true });

	const tmpExtract = path.join(tmpdir(), `node-extract-${platform}-${Date.now()}`);
	await mkdir(tmpExtract, { recursive: true });

	try {
		if (config.nodeArchiveExt === "tar.gz") {
			// 提取 node-vX.Y.Z-{platform}/bin/node
			const entryPath = `${config.nodePkg}/${config.nodeBinRelPath}`;
			execFileSync("tar", ["xzf", archivePath, "-C", tmpExtract, entryPath]);
			const extracted = path.join(tmpExtract, entryPath);
			await cp(extracted, dstPath, { force: true });
			await chmod(dstPath, 0o755);
		} else {
			// Windows zip: node-vX.Y.Z-win-x64/node.exe
			execFileSync("unzip", ["-q", "-o", archivePath, "-d", tmpExtract]);
			const extracted = path.join(tmpExtract, config.nodePkg, config.nodeBinRelPath);
			await cp(extracted, dstPath, { force: true });
		}
	} finally {
		await rm(tmpExtract, { recursive: true, force: true });
	}
}

/**
 * 打包单个平台的 Runtime tar.gz
 * 包内结构:
 *   openclaw-runtime/
 *     openclaw.mjs
 *     dist/
 *     node/bin/node   (unix) 或 node/node.exe (windows)
 */
async function packagePlatform(platform, openclawSrc, version) {
	const tmpDir = path.join(tmpdir(), `ocruntime-${platform}-${Date.now()}`);
	const runtimeDir = path.join(tmpDir, "openclaw-runtime");
	await mkdir(runtimeDir, { recursive: true });

	// 1. 复制 openclaw 文件
	log(`  [${platform}] 复制 openclaw 文件...`);
	for (const entry of OPENCLAW_FILES) {
		const src = path.join(openclawSrc, entry);
		if (existsSync(src)) {
			await cp(src, path.join(runtimeDir, entry), { recursive: true, force: true });
		}
	}

	// 2. 提取 Node.js 二进制
	const config = PLATFORMS[platform];
	const ext = config.nodeArchiveExt;
	const archivePath = path.join(nodeArchiveCache, `node-${platform}.${ext}`);
	if (!existsSync(archivePath)) {
		throw new Error(`Node 缓存包不存在: ${archivePath}，请先下载`);
	}
	log(`  [${platform}] 提取 Node.js 二进制...`);
	await extractNodeBinary(archivePath, platform, runtimeDir);

	// 3. 校验必要文件
	const mjs = path.join(runtimeDir, "openclaw.mjs");
	const distEntry =
		path.join(runtimeDir, "dist", "entry.js") || path.join(runtimeDir, "dist", "entry.mjs");
	if (!existsSync(mjs)) {
		throw new Error(`[${platform}] 缺少 openclaw.mjs，请先构建 openclaw`);
	}

	// 4. 打包为 tar.gz
	const outFile = path.join(outputDir, `${platform}.tar.gz`);
	log(`  [${platform}] 压缩 → ${path.basename(outFile)}`);
	execFileSync("tar", ["czf", outFile, "-C", tmpDir, "openclaw-runtime"]);

	// 5. 计算 sha256
	const checksum = await sha256File(outFile);
	const sizeMB = ((await readFile(outFile)).length / 1024 / 1024).toFixed(1);

	log(`  [${platform}] 完成 ${sizeMB}MB  sha256: ${checksum.slice(0, 16)}...`);

	await rm(tmpDir, { recursive: true, force: true });

	return {
		url: `__CDN_BASE_URL__/${version}/${platform}.tar.gz`,
		sha256: checksum,
	};
}

// ─── 查找 openclaw 源目录 ──────────────────────────────────────

function resolveOpenclawSrc() {
	const candidates = [
		process.env.OPENCLAW_RUNTIME_SOURCE,
		path.resolve(projectRoot, "..", "openclaw"),
		path.resolve(projectRoot, "..", "openclaw-runtime"),
	].filter(Boolean);

	for (const candidate of candidates) {
		const mjs = path.join(candidate, "openclaw.mjs");
		const distEntryJs = path.join(candidate, "dist", "entry.js");
		const distEntryMjs = path.join(candidate, "dist", "entry.mjs");
		if (existsSync(mjs) && (existsSync(distEntryJs) || existsSync(distEntryMjs))) {
			return candidate;
		}
	}
	return null;
}

// ─── main ─────────────────────────────────────────────────────

async function main() {
	const args = process.argv.slice(2);

	// --version 1.0.0
	const versionIdx = args.indexOf("--version");
	const version = versionIdx >= 0 ? args[versionIdx + 1] : "latest";

	// --platform darwin-arm64  (默认全部)
	const platformIdx = args.indexOf("--platform");
	const targetPlatforms =
		platformIdx >= 0 ? [args[platformIdx + 1]] : Object.keys(PLATFORMS);

	log(`\n=== OpenClaw Runtime CDN 打包工具 ===`);
	log(`Node.js 版本: v${NODE_VERSION}  (可用 NODE_RELEASE_VERSION 覆盖)`);
	log(`目标平台: ${targetPlatforms.join(", ")}`);
	log(`打包版本: ${version}\n`);

	// 1. 找 openclaw 源
	const openclawSrc = resolveOpenclawSrc();
	if (!openclawSrc) {
		throw new Error(
			[
				"找不到可用的 OpenClaw 源目录。",
				"需要包含 openclaw.mjs 和 dist/entry.js 的已构建目录。",
				"请先在 openclaw 目录执行: pnpm build",
				"或设置环境变量: OPENCLAW_RUNTIME_SOURCE=/path/to/openclaw",
			].join("\n"),
		);
	}
	log(`OpenClaw 源: ${openclawSrc}`);

	await mkdir(outputDir, { recursive: true });
	await mkdir(nodeArchiveCache, { recursive: true });

	// 2. 下载 Node.js 发行包（跳过已缓存）
	log("\n--- 下载 Node.js 发行包 ---");
	for (const platform of targetPlatforms) {
		const config = PLATFORMS[platform];
		const archivePath = path.join(nodeArchiveCache, `node-${platform}.${config.nodeArchiveExt}`);
		if (existsSync(archivePath)) {
			log(`  [${platform}] 已缓存，跳过`);
			continue;
		}
		log(`\n  [${platform}]`);
		await downloadFile(config.nodeUrl, archivePath);
	}

	// 3. 打包每个平台
	log("\n--- 打包各平台 Runtime ---");
	const manifest = {
		version,
		node_version: NODE_VERSION,
		created_at: new Date().toISOString(),
		platforms: {},
	};

	for (const platform of targetPlatforms) {
		log(`\n[${platform}]`);
		manifest.platforms[platform] = await packagePlatform(platform, openclawSrc, version);
	}

	// 4. 写 manifest.json
	const manifestPath = path.join(outputDir, "manifest.json");
	await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n");

	log(`\n=== 打包完成 ===`);
	log(`输出目录: ${outputDir}`);
	log(`\n上传步骤:`);
	log(`  1. 将 ${outputDir} 中的文件上传到 nginx`);
	log(
		`  2. 更新 manifest.json 中的 __CDN_BASE_URL__ 为实际地址，如 https://cdn.example.com/openclaw-runtime`,
	);
	log(`  3. 在 openclaw-mate 的 SettingsPage.tsx 中配置 RUNTIME_MANIFEST_URL 常量\n`);
}

main().catch((err) => {
	process.stderr.write(`\n打包失败: ${err.message}\n`);
	process.exitCode = 1;
});
