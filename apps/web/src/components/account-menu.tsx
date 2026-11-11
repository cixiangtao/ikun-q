import { useRef, useState } from 'react';
import { useLikes } from '@/components/likes-provider';
import { Button } from '@ikun-q/ui/components/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@ikun-q/ui/components/dialog';
import { LogOutIcon, UserRoundIcon } from 'lucide-react';

/** Profile is always discoverable; account actions appear only for a signed-in viewer. */
export function AccountMenu({ active = false }: { active?: boolean }) {
  const { auth, logout, signingOut, pending } = useLikes();
  const [logoutOpen, setLogoutOpen] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  return (
    <div className="account-menu">
      <a
        href="#/me"
        className="profile-link"
        aria-label="我的主页"
        aria-current={active ? 'page' : undefined}
        title={auth.user?.name ?? '我的主页'}
      >
        <UserRoundIcon aria-hidden="true" />
        <span className="account-name">{auth.user?.name ?? '我的主页'}</span>
      </a>
      {auth.user ? (
        <Dialog open={logoutOpen} onOpenChange={setLogoutOpen}>
          <DialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              title="退出登录"
              disabled={signingOut || pending.size > 0}
            >
              <LogOutIcon aria-hidden="true" />
              <span className="sr-only">{signingOut ? '正在退出…' : '退出登录'}</span>
            </Button>
          </DialogTrigger>
          <DialogContent
            onOpenAutoFocus={(event) => {
              event.preventDefault();
              cancelRef.current?.focus();
            }}
          >
            <DialogHeader>
              <DialogTitle>确认退出登录？</DialogTitle>
              <DialogDescription>
                退出后仍可浏览和下载图片，收藏和赞踩需要重新登录。
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button ref={cancelRef} variant="outline">
                  取消
                </Button>
              </DialogClose>
              <Button
                disabled={signingOut || pending.size > 0}
                onClick={() => {
                  setLogoutOpen(false);
                  void logout();
                }}
              >
                确认退出
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}
