# IKUN-Q 共创准备版

用同一只 IKUN 小鸟，演绎不同人物的 Q 版形象。我们希望邀请创作者、考据者和开发者一起建设角色创作社区。

这是从创作主仓按白名单导出的独立运行快照。当前内置三张程序生成的色块示例，仅用于验证图鉴与工具；它们不是 IKUN 原型或联动作品。最小创作包另附一张已确认用途的完整原始参考图；图片正式投稿与社区作品展示仍在准备中。

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

## 创作台

运行网站后打开`#/create`，填写人物、服装、配色、神态和装备，整理可编辑提示词，下载完整原图并保存创作方案。无需登录或AI密钥，填写内容只在本次页面内保留，不会上传。站内导航保留编辑，刷新前请保存；复制失败时可手动复制。B基础规则见[CREATION_RULES.md](CREATION_RULES.md)，图片范围见[参考图使用说明](REFERENCE_USE.md)。

## 从哪里参与

先读[身份特征入门](CHARACTER_GUIDE.md)，了解核心识别点、可变化部分与原图中无需默认继承的元素。再从[最小创作包](STARTER_KIT.md)下载完整原始参考，按[参考图使用说明](REFERENCE_USE.md)准备创作，无需另找替代原型。

第一期开放[小鸟图书管理员文字方案](CHALLENGE_001.md)。[最小创作包说明](STARTER_KIT.md)列出材料、表单与反馈流程；可以先下载[共创简报](templates/共创简报.md)，再到[首期表单](https://github.com/cixiangtao/ikun-q/issues/new?template=creative-brief.yml)亲自提交，获得可查询的Issue编号。原型已提供，角色作品的正式收录流程仍待开放。

阅读[贡献说明](CONTRIBUTING.md)，准备[投稿清单](templates/共创投稿.md)。[讨论区](https://github.com/cixiangtao/ikun-q/discussions)用于交流选题与方法，[Issues](https://github.com/cixiangtao/ikun-q/issues/new/choose)用于具体建议与问题，[Pull requests](https://github.com/cixiangtao/ikun-q/pulls)用于代码协作。创作规范与可用素材会随创作包逐步接入；角色作品正式收录入口仍在准备中。

图鉴前端在 `apps/web/`，公共组件在 `packages/ui/`，数据约束在 `packages/catalog/`，目录同步在 `scripts/catalog-sync.ts`。`apps/worker/` 提供账号互动方案，`apps/api/` 保留匿名点赞的 Node 自托管实现，两者能力不同。

示例素材以 `assets/manifest.json` 为唯一索引。只修改明确选择的条目，再运行 `corepack pnpm catalog:sync`；生成目录不手改。展示与定稿独立，示例保持草稿状态。

## 公开范围与许可状态

本快照包含一张按[参考图使用说明](REFERENCE_USE.md)提供的原始小鸟；不含历史联动图、实际提示词、创作反馈、生产数据库、密钥、生产账号／数据库标识或主仓 Git 历史。图鉴演示图仍由导出脚本生成。

首版自主代码、随附说明和程序生成的几何示例采用 [MIT](LICENSE) 许可，上游 shadcn 声明见[第三方声明](THIRD_PARTY_NOTICES.md)。代码MIT不覆盖原始小鸟；原图仅按[参考图使用说明](REFERENCE_USE.md)列出的三项确认用途提供。联动作品及名称／标识的使用权另行处理；后续素材逐项标注许可。请勿将几何占位示例当作角色原型。

公开版使用只读权限的GitHub Actions检查，运行安装与完整check，不使用生产密钥、不自动部署。尚未配置云端发布流程，不要向生产站点提交或部署本示例。真实网站的素材与生产部署由维护者单独管理。
