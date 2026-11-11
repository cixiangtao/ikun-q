import { ArrowLeftIcon, ArrowUpRightIcon, DownloadIcon } from 'lucide-react';
import { Button } from '@ikun-q/ui/components/button';
import contributionTemplate from '../../../../templates/共创投稿.md?raw';
import creativeBrief from '../../../../templates/共创简报.md?raw';
import originalReference from '../../../../references/ikun-original.webp';

const templateUrl = `data:text/markdown;charset=utf-8,${encodeURIComponent(contributionTemplate)}`;
const briefUrl = `data:text/markdown;charset=utf-8,${encodeURIComponent(creativeBrief)}`;

/** Explains the preparation stage; downloading the checklist never submits a contribution. */
export function ContributionGuide() {
  return (
    <article className="contribution-page">
      <a className="back-link" href="#/">
        <ArrowLeftIcon aria-hidden="true" />
        返回图鉴
      </a>
      <header className="contribution-heading">
        <h1>一起创作下一只小鸟</h1>
        <p>
          一个新造型、一处装备修正、一段有用的创作经验，都可以成为参与 IKUN-Q 的开始。
          不需要先学会写代码。
        </p>
        <p className="contribution-status">
          代码与最小创作包已开放，欢迎一起改进网站、交流选题与创作方法。首期先收文字方案，图片作品的正式收录仍在准备中。
        </p>
        <div className="contribution-links">
          <Button asChild variant="outline" size="lg">
            <a href="https://github.com/cixiangtao/ikun-q" target="_blank" rel="noreferrer">
              开源仓库
              <ArrowUpRightIcon data-icon="inline-end" />
            </a>
          </Button>
          <Button asChild variant="outline" size="lg">
            <a
              href="https://github.com/cixiangtao/ikun-q/discussions"
              target="_blank"
              rel="noreferrer"
            >
              交流选题与方法
              <ArrowUpRightIcon data-icon="inline-end" />
            </a>
          </Button>
          <Button asChild variant="outline" size="lg">
            <a
              href="https://github.com/cixiangtao/ikun-q/issues/new/choose"
              target="_blank"
              rel="noreferrer"
            >
              提出改进建议
              <ArrowUpRightIcon data-icon="inline-end" />
            </a>
          </Button>
        </div>
        <Button asChild size="lg">
          <a href={templateUrl} download="ikun-q-contribution.md">
            <DownloadIcon data-icon="inline-start" />
            下载投稿清单
          </a>
        </Button>
        <p className="contribution-download-note">Markdown 文本文件；下载和填写都不会上传内容。</p>
      </header>
      <div className="contribution-layout">
        <aside className="contribution-outline" aria-label="指南内容">
          <span>这份指南里</span>
          <p>首期文字共创</p>
          <p>完整原始参考</p>
          <p>可以做什么</p>
          <p>开始前准备什么</p>
          <p>作品怎样被看见</p>
        </aside>
        <div className="contribution-content">
          <section aria-labelledby="contribution-first-task">
            <h2 id="contribution-first-task">首期共创：小鸟图书管理员</h2>
            <p>
              先用文字设计一位图书管理员：穿什么、用什么配色、怎样抱书，以及用什么神态表达性格。
              保留熟悉的小鸟身份，把手、书本与衣服的关系说清楚即可，当前无需附图或先付费生图。
            </p>
            <div className="contribution-links mt-5">
              <Button asChild size="lg" className="min-h-11">
                <a
                  href="https://github.com/cixiangtao/ikun-q/issues/new?template=creative-brief.yml"
                  target="_blank"
                  rel="noreferrer"
                >
                  填写首期文字方案
                  <ArrowUpRightIcon data-icon="inline-end" />
                </a>
              </Button>
              <Button asChild variant="outline" size="lg" className="min-h-11">
                <a href={briefUrl} download="ikun-q-creative-brief.md">
                  <DownloadIcon data-icon="inline-start" />
                  下载创作简报
                </a>
              </Button>
            </div>
            <a
              className="about-contribution-link"
              href="https://github.com/cixiangtao/ikun-q/blob/main/STARTER_KIT.md"
              target="_blank"
              rel="noreferrer"
            >
              阅读任务与提交说明
              <ArrowUpRightIcon aria-hidden="true" />
            </a>
            <p>
              在 GitHub 登录并提交后会获得 Issue 编号，方案和反馈公开可查；无需会 Git。
              维护者通过评论及“待查看、需补充、可采用、本次不采用”标签人工反馈，文字方案可采用不等于图片已收录。
              可以按参考图使用说明准备创作，图片投稿与正式收录流程将另行公布。
            </p>
          </section>
          <section aria-labelledby="contribution-reference">
            <h2 id="contribution-reference">完整原图，作为共同起点</h2>
            <p>
              提供原始 1000 × 986 WebP，不拆零件。已确认供公开下载、社区 AI
              生成／改编及生成结果在社区展示；图片使用范围与代码 MIT 分开，原作者署名待补充。
            </p>
            <div className="contribution-links mt-5">
              <Button asChild size="lg" className="min-h-11">
                <a href={originalReference} download="ikun-q-original.webp">
                  <DownloadIcon data-icon="inline-start" />
                  下载原始参考图
                </a>
              </Button>
              <Button asChild variant="outline" size="lg" className="min-h-11">
                <a
                  href="https://github.com/cixiangtao/ikun-q/blob/main/REFERENCE_USE.md"
                  target="_blank"
                  rel="noreferrer"
                >
                  参考图使用说明
                  <ArrowUpRightIcon data-icon="inline-end" />
                </a>
              </Button>
            </div>
            <p>
              B 新图只输入完整原图；Q 仅在明确请求时从选定 B 派生。当前首期仍先收文字，
              下载或生成图片不会自动进入图鉴。
            </p>
          </section>
          <section aria-labelledby="contribution-directions">
            <h2 id="contribution-directions">从你擅长的事开始</h2>
            <dl className="contribution-directions">
              <div>
                <dt>提出人物与造型</dt>
                <dd>说说你想看到谁、哪个服装版本，以及最能认出这个人物的细节。</dd>
              </div>
              <div>
                <dt>一起打磨作品</dt>
                <dd>发现服装、装备或结构问题时，带上图片链接，指出具体位置和修改建议。</dd>
              </div>
              <div>
                <dt>分享方法与考据</dt>
                <dd>整理有帮助的创作方法、提示词片段、人物资料，或让介绍和标签更准确。</dd>
              </div>
              <div>
                <dt>改进网站与工具</dt>
                <dd>记录使用中遇到的问题，或用代码让浏览、创作和协作更方便。</dd>
              </div>
            </dl>
          </section>
          <section aria-labelledby="contribution-preparation">
            <h2 id="contribution-preparation">先准备一份清楚的说明</h2>
            <p>
              初次参与可以先读身份特征说明，分清中分、眼睛与红脸颊等识别点，以及配色、表情和服装的变化范围。
            </p>
            <a
              className="about-contribution-link"
              href="https://github.com/cixiangtao/ikun-q/blob/main/CHARACTER_GUIDE.md"
              target="_blank"
              rel="noreferrer"
            >
              阅读身份特征说明
              <ArrowUpRightIcon aria-hidden="true" />
            </a>
            <ol className="contribution-steps">
              <li>
                <strong>选一个具体想法。</strong>
                一次围绕一个人物、问题或改进点，说明希望达到的效果。
              </li>
              <li>
                <strong>留下署名和来源。</strong>
                写下希望展示的名字、协作者，以及参考资料或已有作品链接。
              </li>
              <li>
                <strong>说明做了什么。</strong>
                作品附上制作方式、是否使用
                AI、原始尺寸和修改范围；方法分享可以只提供愿意公开的部分。
              </li>
              <li>
                <strong>写下使用意向。</strong>
                说明对展示、他人修改、再分发与商业使用的想法。正式提交前还会确认具体条件。
              </li>
            </ol>
            <p>
              无需先付费生图。原始参考图按使用说明提供，其他现有作品仍需分别确认使用范围；
              准备资料时也不需要附上账号凭据、私人聊天或私人联系方式。
            </p>
          </section>
          <section aria-labelledby="contribution-credit">
            <h2 id="contribution-credit">让每一份贡献都有来处</h2>
            <p>
              我们希望收录时展示作者署名、协作者与作品来源，并给投稿者清楚的反馈。
              社区作品展示区和投稿状态查询将逐步建设，当前还未开放。
            </p>
            <p>
              主图鉴会继续保持统一的形象标准。作品是否进入主图，将与社区交流展示分开处理；
              点赞与收藏表达喜好，收录还需要检查作品质量、来源和使用许可。
            </p>
            <p>
              站内 GitHub 登录用于收藏和赞踩。代码、选题与方法请使用上方 GitHub
              入口交流；角色作品的正式收录入口会在本页另行公布。
            </p>
          </section>
        </div>
      </div>
    </article>
  );
}
