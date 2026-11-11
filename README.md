# IKUN-Q 共创准备版

用同一只 IKUN 小鸟，演绎不同人物的 Q 版形象。我们希望邀请创作者、考据者和开发者一起建设角色创作社区。

这是从创作主仓按白名单导出的独立运行快照。当前内置三张程序生成的色块示例，仅用于验证图鉴与工具；它们不是 IKUN 原型或联动作品。真实创作包、素材使用范围、正式投稿与社区作品展示仍在准备中。

## 本地运行

需要 `.nvmrc` 中的 Node 与 `package.json.packageManager` 中的 pnpm：

```sh
nvm use
corepack pnpm install --frozen-lockfile
corepack pnpm dev
```

只浏览页面不需要云端账号。完整的本地 Workers + D1 预览：

```sh
corepack pnpm dev:cloudflare
```

GitHub 登录需自行配置 `apps/worker/.dev.vars`，示例见同目录 `.dev.vars.example`。未配置时浏览与下载仍可用，账号互动关闭。运行 `corepack pnpm check` 执行格式、lint、类型、测试及构建，不修改远程数据。

## 从哪里参与

阅读[贡献说明](CONTRIBUTING.md)，准备[投稿清单](templates/共创投稿.md)。[讨论区](https://github.com/cixiangtao/ikun-q/discussions)用于交流选题与方法，[Issues](https://github.com/cixiangtao/ikun-q/issues/new/choose)用于具体建议与问题，[Pull requests](https://github.com/cixiangtao/ikun-q/pulls)用于代码协作。创作规范与可用素材会随创作包逐步接入；角色作品正式收录入口仍在准备中。

图鉴前端在 `apps/web/`，公共组件在 `packages/ui/`，数据约束在 `packages/catalog/`，目录同步在 `scripts/catalog-sync.ts`。`apps/worker/` 提供账号互动方案，`apps/api/` 保留匿名点赞的 Node 自托管实现，两者能力不同。

示例素材以 `assets/manifest.json` 为唯一索引。只修改明确选择的条目，再运行 `corepack pnpm catalog:sync`；生成目录不手改。展示与定稿独立，示例保持草稿状态。

## 公开范围与许可状态

本快照不含原型、历史联动图、实际提示词、创作反馈、生产数据库、密钥、生产账号／数据库标识或主仓 Git 历史。示例图全部由导出脚本生成。

首版自主代码、随附说明和程序生成的几何示例采用 [MIT](LICENSE) 许可，上游 shadcn 声明见[第三方声明](THIRD_PARTY_NOTICES.md)。本许可不授予 IKUN 原型、联动作品或名称／标识的使用权，这些内容不在本仓库分发范围内；后续素材逐项标注许可。请勿将几何占位示例当作角色原型。

公开版使用只读权限的GitHub Actions检查，运行安装与完整check，不使用生产密钥、不自动部署。尚未配置云端发布流程，不要向生产站点提交或部署本示例。真实网站的素材与生产部署由维护者单独管理。
