import { useEffect, useState } from 'react';
import type { Artwork } from '@ikun-q/catalog';
import { DownloadIcon, ImageIcon, Share2Icon } from 'lucide-react';
import { Button } from '@ikun-q/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@ikun-q/ui/components/dialog';
import { fullImageUrl } from '@/lib/catalog';

/** Opens a full-size, unlinked image for long-press saving, with native file sharing where supported. */
export function ArtworkDownload({ artwork }: { artwork: Artwork }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg">
          <ImageIcon data-icon="inline-start" />
          保存图片
        </Button>
      </DialogTrigger>
      <DialogContent className="image-save-dialog">
        <DialogHeader>
          <DialogTitle>保存{artwork.character}图片</DialogTitle>
          <DialogDescription>
            长按下方图片保存到相册。iPhone 请在菜单中选择“存储到照片”或“添加到照片”。
          </DialogDescription>
        </DialogHeader>
        {open ? <SaveImagePanel key={artwork.id} artwork={artwork} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function SaveImagePanel({ artwork }: { artwork: Artwork }) {
  const url = fullImageUrl(artwork);
  const filename = `${artwork.id}.png`;
  const [file, setFile] = useState<File>();
  const [imageReady, setImageReady] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [shareFailed, setShareFailed] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const shareAvailable =
    typeof navigator.share === 'function' && typeof navigator.canShare === 'function';

  useEffect(() => {
    if (!shareAvailable) return;
    const controller = new AbortController();
    async function prepareFile() {
      try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw new Error('图片读取失败。');
        const prepared = new File([await response.blob()], filename, { type: 'image/png' });
        if (!controller.signal.aborted && navigator.canShare({ files: [prepared] }))
          setFile(prepared);
      } catch {
        if (!controller.signal.aborted) setShareFailed(true);
      }
    }
    void prepareFile();
    return () => controller.abort();
  }, [url, filename, shareAvailable, attempt]);

  async function shareImage() {
    if (!file || sharing) return;
    setSharing(true);
    setShareFailed(false);
    try {
      // Prepare before the click: awaiting a fetch here can lose iOS transient user activation.
      await navigator.share({ files: [file] });
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) setShareFailed(true);
    } finally {
      setSharing(false);
    }
  }

  return (
    <>
      <div className="image-save-preview">
        <img
          key={attempt}
          src={url}
          width={artwork.width}
          height={artwork.height}
          alt={`${artwork.character}原始图片，可长按保存`}
          onLoad={() => setImageReady(true)}
          onError={() => {
            setImageReady(false);
            setImageFailed(true);
          }}
        />
      </div>
      <p className="image-save-caption">
        {artwork.width} × {artwork.height} · PNG 原图
      </p>
      <output className="image-save-note" aria-live="polite">
        {imageFailed
          ? '图片加载失败，请重试。'
          : !imageReady
            ? '正在加载完整图片…'
            : shareFailed
              ? '系统分享暂不可用，可以长按上方图片保存到相册。'
              : '长按图片保存；也可打开图片后保存。'}
      </output>
      <div className="image-save-actions">
        {imageFailed || shareFailed ? (
          <Button
            variant="outline"
            onClick={() => {
              setImageFailed(false);
              setShareFailed(false);
              setImageReady(false);
              setFile(undefined);
              setAttempt((value) => value + 1);
            }}
          >
            重新加载
          </Button>
        ) : null}
        {file ? (
          <Button disabled={sharing} onClick={shareImage}>
            <Share2Icon data-icon="inline-start" />
            {sharing ? '正在分享…' : '系统分享'}
          </Button>
        ) : null}
        <Button asChild variant="outline">
          <a href={url} target="_blank" rel="noreferrer">
            打开图片
          </a>
        </Button>
        <Button asChild variant="ghost">
          <a href={url} download={filename}>
            <DownloadIcon data-icon="inline-start" />
            下载文件
          </a>
        </Button>
      </div>
    </>
  );
}
