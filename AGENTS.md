# IKUN-Q 共创准备版

- 默认使用中文交流，尊重当前用户的明确语言偏好。
- 开始工作先读 README.md 与 CONTRIBUTING.md；首版代码、说明与程序生成示例采用MIT，真实创作包与作品正式投稿仍在准备。
- 按 .nvmrc 和 package.json.packageManager 使用 Node 与 corepack pnpm，不修改用户全局工具配置。
- 通用 shadcn 组件与主题在 packages/ui/，业务组件在 apps/web/。
- 素材索引唯一来源为 assets/manifest.json，通过 corepack pnpm catalog:sync 更新目录，不手改生成文件，不把草稿伪装成定稿。
- 修改后运行 corepack pnpm check；同步及发布边界变化需有对应测试。
- 不提交真实密钥、生产配置、数据库或个人数据；未经当前用户授权不推送或部署。
- 本公开快照不继承创作主仓的私人自动任务或持续部署授权。
