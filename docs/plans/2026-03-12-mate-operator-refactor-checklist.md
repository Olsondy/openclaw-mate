# Mate Operator Refactor Checklist

## 目标

- 移除 `mate -> tenant -> bootstrap-config` 的配置写入链路。
- 所有网关配置修改统一走 `operator` RPC（`config.patch`）。
- 连接入口语义改为：
  - 租户（Tenant）：通过租户接口拿网关连接信息。
  - 直连（Direct）：本地网关自动探测，或云端网关地址手动输入。

## 执行清单

- [x] 重构连接层
  - [x] 保留租户验证连接 `verifyAndConnect`。
  - [x] 新增直连网关连接 `connectDirectGateway`。
  - [x] 侧边栏重连按当前模式切换（租户/直连）。
- [x] 重构设置页入口
  - [x] 两张卡片语义调整为“租户 / 直连”。
  - [x] 点击“直连”弹出二级选择：本地网关 / 云端网关。
  - [x] 云端网关支持地址输入（可选 token）。
  - [x] 本地网关走自动探测。
- [x] 重构配置向导
  - [x] `ApiWizard` 改为 `operator config.patch`。
  - [x] `FeishuWizard` 改为 `operator config.patch`。
  - [x] `TelegramWizard` 改为 `operator config.patch`。
- [x] 去除本地文件写配置行为
  - [x] `local_connect.rs` 移除对 `devices/paired.json` 的写入与重启逻辑。
  - [x] 本地连接改为只读探测（端口 + token）。
- [x] 文案与测试
  - [x] i18n 文案统一“租户 / 直连”语义。
  - [x] `ApiWizard` 单测从 tenant 请求改为 operator patch 断言。

## 后续建议

- [x] 将 `connectionMode` 的内部值从 `license/local` 迁移到 `tenant/direct`（保留启动时对旧值的兼容映射）。
- [x] 清理已废弃的 `bootstrap.store`。
- [x] 清理 `SwitchModeDialog`，切换确认逻辑收敛到 `SettingsPage` 内部。
- [x] 为 `FeishuWizard` / `TelegramWizard` 增补 operator 流程测试。
