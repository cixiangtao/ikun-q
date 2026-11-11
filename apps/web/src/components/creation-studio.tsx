import { useRef, useState, type FormEvent } from 'react';
import { ArrowLeftIcon, ArrowUpRightIcon, CopyIcon, DownloadIcon } from 'lucide-react';
import { Button } from '@ikun-q/ui/components/button';
import { Input } from '@ikun-q/ui/components/input';
import { Textarea } from '@ikun-q/ui/components/textarea';
import { Field, FieldGroup, FieldLabel } from '@ikun-q/ui/components/field';
import {
  buildCreationPrompt,
  designFields,
  exportCreationPlan,
  librarianExample,
  type CreationDesign,
} from '@/lib/creation-plan';
import originalReference from '../../../../references/ikun-original.webp';

const rules = __IKUN_CREATION_RULES__;
const initialPrompt = buildCreationPrompt(librarianExample, rules);

/** A local-only B design workspace. Keeping it mounted preserves edits while navigating the gallery. */
export function CreationStudio() {
  const [design, setDesign] = useState<CreationDesign>({ ...librarianExample });
  const [preparedDesign, setPreparedDesign] = useState<CreationDesign>(design);
  const [preparedPrompt, setPreparedPrompt] = useState(initialPrompt);
  const [prompt, setPrompt] = useState(initialPrompt);
  const [notice, setNotice] = useState('');
  const output = useRef<HTMLTextAreaElement>(null);
  const designChanged = JSON.stringify(design) !== JSON.stringify(preparedDesign);
  const promptEdited = prompt !== preparedPrompt;
  const planUrl = `data:text/markdown;charset=utf-8,${encodeURIComponent(exportCreationPlan(design, prompt))}`;

  function updateDesign(key: keyof CreationDesign, value: string) {
    setDesign((current) => ({ ...current, [key]: value }));
    setNotice('');
  }

  function preparePrompt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!design.subject.trim()) return;
    const next = buildCreationPrompt(design, rules);
    setPreparedDesign({ ...design });
    setPreparedPrompt(next);
    setPrompt(next);
    setNotice('已按当前设计整理提示词，可以继续编辑。');
    output.current?.focus();
  }

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(prompt);
      setNotice('提示词已复制。请在自己的AI工具中上传完整原图，再粘贴提示词。');
    } catch {
      output.current?.focus();
      output.current?.select();
      setNotice('未能访问剪贴板，已选中提示词。请长按或使用系统复制命令。');
    }
  }

  return (
    <article className="creation-page">
      <a className="back-link" href="#/">
        <ArrowLeftIcon aria-hidden="true" />
        返回图鉴
      </a>
      <header className="creation-heading">
        <h1>创作台</h1>
        <p>把一个想法，整理成下一只小鸟。填写设计，带上原图和提示词，到自己的AI工具里开始创作。</p>
      </header>
      <div className="creation-workspace">
        <form className="creation-design" onSubmit={preparePrompt}>
          <div className="creation-section-heading">
            <h2>这次想创作谁</h2>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setDesign({ ...librarianExample });
                setNotice('已载入图书管理员示例，当前提示词未被替换。');
              }}
            >
              载入示例
            </Button>
          </div>
          <p className="creation-note">
            从图书管理员示例开始，或替换为自己的设计。默认制作B精细主形象。
          </p>
          <FieldGroup className="creation-fields">
            {designFields.map(({ key, label, placeholder, multiline }) => (
              <Field
                key={key}
                className={
                  key === 'face' || key === 'hair' ? 'creation-color-field' : 'creation-wide-field'
                }
              >
                <FieldLabel htmlFor={`creation-${key}`}>
                  {label}
                  {key === 'subject' ? '（必填）' : ''}
                </FieldLabel>
                {multiline ? (
                  <Textarea
                    id={`creation-${key}`}
                    value={design[key]}
                    placeholder={placeholder}
                    maxLength={800}
                    rows={3}
                    onChange={(event) => updateDesign(key, event.target.value)}
                  />
                ) : (
                  <Input
                    id={`creation-${key}`}
                    value={design[key]}
                    placeholder={placeholder}
                    required={key === 'subject'}
                    pattern={key === 'subject' ? '.*\\S.*' : undefined}
                    maxLength={key === 'subject' ? 80 : 200}
                    onChange={(event) => updateDesign(key, event.target.value)}
                  />
                )}
              </Field>
            ))}
          </FieldGroup>
          <div className="creation-prepare">
            <Button type="submit" size="lg" className="min-h-11">
              {promptEdited ? '按当前设计替换提示词' : '整理提示词'}
            </Button>
            <p className="creation-note">
              {promptEdited
                ? '提示词有手动修改；替换前可以先复制或保存。'
                : '修改设计后点击整理，提示词才会更新。'}
            </p>
          </div>
        </form>
        <section className="creation-output" aria-labelledby="creation-output-heading">
          <h2 id="creation-output-heading">带走这份创作方案</h2>
          <div className="creation-reference">
            <img
              src={originalReference}
              width={1000}
              height={986}
              alt="完整原始小鸟参考：中分、大白眼、橙色鸟喙和红脸颊"
            />
            <div>
              <h3>只上传这一张完整原图</h3>
              <p className="creation-note">1000 × 986 WebP · 不拆零件。其他人物特征用文字描述。</p>
              <a
                className="creation-text-link"
                href={originalReference}
                download="ikun-q-original.webp"
              >
                下载原始参考图
                <DownloadIcon aria-hidden="true" />
              </a>
              <a
                className="creation-text-link"
                href="https://github.com/cixiangtao/ikun-q/blob/main/REFERENCE_USE.md"
                target="_blank"
                rel="noreferrer"
              >
                参考图使用说明
                <ArrowUpRightIcon aria-hidden="true" />
              </a>
            </div>
          </div>
          <Field>
            <FieldLabel htmlFor="creation-prompt">完整提示词（可编辑）</FieldLabel>
            <p id="creation-prompt-help" className="creation-note">
              基础规则已带入中分、眼睛、红脸颊、朝向与B画风。请检查人物设计是否协调。
            </p>
            <Textarea
              ref={output}
              id="creation-prompt"
              className="creation-prompt"
              aria-describedby="creation-prompt-help creation-prompt-state"
              value={prompt}
              rows={18}
              maxLength={20000}
              onChange={(event) => {
                setPrompt(event.target.value);
                setNotice('');
              }}
            />
          </Field>
          <p id="creation-prompt-state" className="creation-note">
            {designChanged
              ? '设计已修改，提示词尚未重新整理；手动内容仍保留。'
              : promptEdited
                ? '当前提示词包含手动修改，复制与保存会保留这些内容。'
                : '提示词与当前设计一致，可以继续编辑。'}
          </p>
          <div className="creation-actions">
            <Button
              type="button"
              size="lg"
              className="min-h-11"
              disabled={!prompt.trim()}
              onClick={copyPrompt}
            >
              <CopyIcon data-icon="inline-start" />
              复制提示词
            </Button>
            <Button asChild variant="outline" size="lg" className="min-h-11">
              <a href={planUrl} download="ikun-q-creation-plan.md">
                <DownloadIcon data-icon="inline-start" />
                保存创作方案
              </a>
            </Button>
          </div>
          <output className="creation-notice">{notice}</output>
          <p className="creation-note">
            内容只在本次页面内保留，刷新或关闭前请保存。无需登录，填写与复制不会上传或提交作品。
          </p>
        </section>
      </div>
      <footer className="creation-footer">
        <h2>生成后，再一起打磨</h2>
        <p>
          记录实际尺寸与制作方式，检查小鸟身份、服装、手部和装备的连接。原图按使用说明提供，生成结果仍需验收。
        </p>
        <a className="creation-text-link" href="#/contribute">
          查看共创指南
          <ArrowUpRightIcon aria-hidden="true" />
        </a>
      </footer>
    </article>
  );
}
