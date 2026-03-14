# ClawMate 部署指南

本文档说明如何打包 OpenClaw Runtime CDN 分发包，并将其部署到静态服务器（如 nginx），供 ClawMate 客户端在用户首次使用直连模式时按需下载安装。

---

## 背景

ClawMate 的「网关直连」模式需要本机运行 OpenClaw Runtime（一个 Node.js 应用）。为了让用户零门槛使用，ClawMate 支持在客户端内一键下载安装 Runtime，无需用户手动安装 Node.js 或 npm。

Runtime 分发包由开发者提前打包并托管在静态服务器上。包内已捆绑平台专属的 Node.js 二进制，用户下载后即可直接运行，不依赖系统环境。

---

## 涉及文件

| 文件 | 说明 |
|------|------|
| `scripts/package-runtime-cdn.mjs` | Runtime 打包脚本 |
| `src/pages/SettingsPage.tsx` | 客户端安装入口，含 `RUNTIME_MANIFEST_URL` 常量 |
| `src-tauri/src/local_connect.rs` | Rust 下载/解压命令 `download_and_install_runtime` |

---

## 一、环境准备

### 前置要求

- Node.js >= 18（用于运行打包脚本）
- pnpm（用于构建 openclaw）
- `tar` 命令（macOS/Linux 自带）
- `unzip` 命令（打包 Windows 平台时需要，macOS 自带）
- 可访问 `nodejs.org`（下载 Node.js 二进制，首次打包时需要，之后有缓存）

### 目录结构要求

打包脚本默认在 `../openclaw` 中查找 openclaw 源码。确保目录结构如下：

```
easy-openclaw/
├── openclaw/          ← openclaw 源码仓库
│   ├── openclaw.mjs
│   └── dist/          ← 需要先构建
└── openclaw-mate/     ← 本仓库
    └── scripts/
        └── package-runtime-cdn.mjs
```

---

## 二、构建 OpenClaw

打包前需要先构建 openclaw，生成 `dist/` 目录：

```bash
cd ../openclaw
pnpm install
pnpm build
```

构建完成后，确认以下文件存在：

```
openclaw/
├── openclaw.mjs        ✓
└── dist/
    └── entry.js        ✓  (或 entry.mjs)
```

> **注意**：每次 openclaw 有版本更新，都需要重新执行此步骤，然后重新打包 Runtime 包。

---

## 三、打包 Runtime CDN 包

回到 `openclaw-mate` 目录，运行打包脚本：

```bash
cd openclaw-mate

# 打包所有平台（darwin-arm64 / darwin-x64 / linux-x64 / win-x64）
node scripts/package-runtime-cdn.mjs --version 1.0.0

# 仅打包当前平台（开发调试时使用）
node scripts/package-runtime-cdn.mjs --platform darwin-arm64

# 指定 openclaw 源路径（当目录结构不标准时）
OPENCLAW_RUNTIME_SOURCE=/path/to/openclaw node scripts/package-runtime-cdn.mjs --version 1.0.0

# 指定 Node.js 版本（默认 22.14.0）
NODE_RELEASE_VERSION=22.14.0 node scripts/package-runtime-cdn.mjs --version 1.0.0
```

### 输出结构

打包完成后，产物在 `dist/runtime-cdn/`：

```
dist/runtime-cdn/
├── manifest.json            ← 版本描述文件（需要编辑 URL）
├── darwin-arm64.tar.gz      ← macOS Apple Silicon
├── darwin-x64.tar.gz        ← macOS Intel
├── linux-x64.tar.gz         ← Linux x86_64
├── win-x64.tar.gz           ← Windows x86_64
└── .node-archives/          ← Node.js 发行包缓存（勿删，避免重复下载）
```

每个 `.tar.gz` 包内结构：

```
openclaw-runtime/
├── openclaw.mjs
├── dist/
├── assets/
├── extensions/
├── skills/
├── package.json
└── node/
    └── bin/
        └── node             ← 平台专属 Node.js 二进制
```

### Node.js 下载缓存

首次打包时，脚本会从 `nodejs.org` 下载各平台的 Node.js 发行包（每个约 40MB），缓存到 `dist/runtime-cdn/.node-archives/`。

后续重新打包时，只要缓存存在就会跳过下载，直接复用。

---

## 四、编辑 manifest.json

打包完成后，`manifest.json` 中的 URL 为占位符，需要替换为实际 CDN 地址。

打开 `dist/runtime-cdn/manifest.json`，将 `__CDN_BASE_URL__` 替换为实际地址：

```json
{
  "version": "1.0.0",
  "node_version": "22.14.0",
  "created_at": "2026-03-13T00:00:00.000Z",
  "platforms": {
    "darwin-arm64": {
      "url": "https://cdn.example.com/openclaw-runtime/1.0.0/darwin-arm64.tar.gz",
      "sha256": "abc123..."
    },
    "darwin-x64": {
      "url": "https://cdn.example.com/openclaw-runtime/1.0.0/darwin-x64.tar.gz",
      "sha256": "def456..."
    },
    "linux-x64": {
      "url": "https://cdn.example.com/openclaw-runtime/1.0.0/linux-x64.tar.gz",
      "sha256": "ghi789..."
    },
    "win-x64": {
      "url": "https://cdn.example.com/openclaw-runtime/1.0.0/win-x64.tar.gz",
      "sha256": "jkl012..."
    }
  }
}
```

---

## 五、上传到 nginx

将打包产物上传到 nginx 静态目录，推荐按版本归档：

```bash
# 示例：上传到服务器 /var/www/cdn/openclaw-runtime/
scp dist/runtime-cdn/manifest.json      user@server:/var/www/cdn/openclaw-runtime/latest/
scp dist/runtime-cdn/darwin-arm64.tar.gz user@server:/var/www/cdn/openclaw-runtime/1.0.0/
scp dist/runtime-cdn/darwin-x64.tar.gz  user@server:/var/www/cdn/openclaw-runtime/1.0.0/
scp dist/runtime-cdn/linux-x64.tar.gz   user@server:/var/www/cdn/openclaw-runtime/1.0.0/
scp dist/runtime-cdn/win-x64.tar.gz     user@server:/var/www/cdn/openclaw-runtime/1.0.0/
```

### nginx 配置

确保 nginx 对 `.tar.gz` 文件设置了正确的 MIME 类型和跨域头（若客户端与服务器不同域）：

```nginx
server {
    listen 80;
    server_name cdn.example.com;
    root /var/www/cdn;

    # 允许大文件下载
    location /openclaw-runtime/ {
        add_header Access-Control-Allow-Origin *;
        add_header Cache-Control "public, max-age=31536000, immutable";

        # manifest 不缓存，确保客户端拿到最新版本
        location ~* /manifest\.json$ {
            add_header Cache-Control "no-cache";
            add_header Access-Control-Allow-Origin *;
        }
    }
}
```

### 推荐目录结构

```
/var/www/cdn/openclaw-runtime/
├── latest/
│   └── manifest.json          ← 始终指向最新版本的下载地址
├── 1.0.0/
│   ├── darwin-arm64.tar.gz
│   ├── darwin-x64.tar.gz
│   ├── linux-x64.tar.gz
│   └── win-x64.tar.gz
└── 1.1.0/
    └── ...
```

`latest/manifest.json` 中的 URL 指向具体版本目录，更新时只需替换该文件，不需要移动大文件。

---

## 六、配置客户端 URL

打包并上传完成后，需要在客户端代码中配置 manifest URL。

编辑 `src/pages/SettingsPage.tsx`，找到 `RUNTIME_MANIFEST_URL` 常量并更新：

```typescript
// 约第 703 行
const RUNTIME_MANIFEST_URL =
    "https://cdn.example.com/openclaw-runtime/latest/manifest.json";
```

修改后重新构建并发布 ClawMate 客户端即可。

---

## 七、用户侧体验

用户首次使用直连模式时，若本机未安装 OpenClaw：

1. 连接失败，界面提示"未检测到可用的 OpenClaw Runtime"
2. 出现「**下载安装 Runtime**」按钮
3. 用户点击后，显示实时下载进度条（格式：`67%  38.2MB / 57.1MB`）
4. 下载解压完成，自动重新发起连接
5. 连接成功，Runtime 安装至 `~/.clatemate/runtime/`，后续无需再次下载

Runtime 安装路径：

| 平台 | 路径 |
|------|------|
| macOS / Linux | `~/.clatemate/runtime/openclaw/` |
| Windows | `C:\Users\<用户名>\.clatemate\runtime\openclaw\` |

---

## 八、版本更新流程

当 openclaw 或 Node.js 需要升级时：

```bash
# 1. 更新 openclaw 源码
cd ../openclaw && git pull && pnpm install && pnpm build

# 2. 重新打包（新版本号）
cd ../openclaw-mate
node scripts/package-runtime-cdn.mjs --version 1.1.0

# 3. 编辑 manifest.json，更新 URL 中的版本号

# 4. 上传新版本文件到 nginx
scp dist/runtime-cdn/*.tar.gz user@server:/var/www/cdn/openclaw-runtime/1.1.0/

# 5. 更新 latest/manifest.json（触发客户端使用新版本）
scp dist/runtime-cdn/manifest.json user@server:/var/www/cdn/openclaw-runtime/latest/
```

> 已安装旧版 Runtime 的用户不会自动升级。如需强制升级，需在 ClawMate 客户端实现版本检测逻辑（当前版本暂不支持）。

---

## 九、常见问题

**Q: 打包时提示"找不到 OpenClaw 源目录"**

openclaw 的 `dist/` 尚未构建。先在 openclaw 目录执行 `pnpm build`，或通过环境变量指定已构建的路径：

```bash
OPENCLAW_RUNTIME_SOURCE=/path/to/built/openclaw node scripts/package-runtime-cdn.mjs
```

**Q: 下载 Node.js 发行包速度慢**

Node.js 官方镜像在国内访问较慢。可以手动下载后放入缓存目录，脚本会自动跳过下载：

```bash
# 缓存目录
dist/runtime-cdn/.node-archives/

# 文件命名规则
node-darwin-arm64.tar.gz
node-darwin-x64.tar.gz
node-linux-x64.tar.gz
node-win-x64.zip
```

或使用国内镜像手动下载后重命名放入缓存目录，再运行打包脚本。

**Q: 打包后包体积多大**

每个平台的 `.tar.gz` 约 50-70MB（主要是 Node.js 二进制）。用户下载一次后安装到本地，后续不再下载。

**Q: 用户网络不稳定，下载中断怎么办**

目前下载失败时，界面会显示错误信息，用户可再次点击「下载安装 Runtime」重试。每次下载均为全量下载。
