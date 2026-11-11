import { createContext, useContext, useEffect, useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { createReactionStore } from '@/lib/reaction-store';
import { fetchLikes, setVote, setFavorite, signIn, signOut } from '@/lib/likes';
import { Button } from '@ikun-q/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@ikun-q/ui/components/dialog';

const LikesContext = createContext<ReturnType<typeof createReactionStore> | null>(null);
function load(signal?: AbortSignal) {
  const timeout = AbortSignal.timeout(8000);
  return fetchLikes(signal ? AbortSignal.any([signal, timeout]) : timeout);
}

/** One private snapshot shares account identity, image reactions and favorites across all routes. */
export function LikesProvider({ children }: { children: ReactNode }) {
  const [oauthFailed] = useState(() =>
    new URL(window.location.href).searchParams.has('auth_error'),
  );
  const [loginOpen, setLoginOpen] = useState(oauthFailed);
  const [loginTitle, setLoginTitle] = useState('登录后，保存你的选择');
  const [loginPending, setLoginPending] = useState(false);
  const [loginError, setLoginError] = useState(
    oauthFailed ? '未能完成 GitHub 登录。你可以重试，或继续浏览。' : '',
  );
  const [store] = useState(() =>
    createReactionStore({
      load,
      vote: setVote,
      favorite: setFavorite,
      signOut,
      requestLogin: (reason = '保存你的选择', expired = false) => {
        setLoginTitle(expired ? '重新登录，继续收藏和赞踩' : `登录后，${reason}`);
        setLoginError(expired ? '登录已过期，请重新登录。' : '');
        setLoginOpen(true);
      },
      onLoggedOut: () => setLoginOpen(false),
      onLogoutError: () => {
        setLoginError('退出登录未完成，请重试。');
        setLoginTitle('退出登录未完成');
        setLoginOpen(true);
      },
    }),
  );
  const { auth, status } = useSyncExternalStore(store.subscribe, store.getSnapshot);
  useEffect(() => {
    if (!oauthFailed) return;
    const url = new URL(window.location.href);
    for (const key of ['auth_error', 'error', 'error_description']) url.searchParams.delete(key);
    window.history.replaceState(null, '', url.href);
  }, [oauthFailed]);
  useEffect(() => {
    const restore = (event: PageTransitionEvent) => {
      if (event.persisted) setLoginPending(false);
    };
    window.addEventListener('pageshow', restore);
    return () => window.removeEventListener('pageshow', restore);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void store.refresh(controller.signal);
    return () => controller.abort();
  }, [store]);
  async function login() {
    setLoginPending(true);
    setLoginError('');
    try {
      await signIn();
    } catch {
      setLoginError('暂时无法打开 GitHub 登录，请稍后重试。');
      setLoginPending(false);
    }
  }
  return (
    <LikesContext.Provider value={store}>
      {children}
      <Dialog
        open={loginOpen}
        onOpenChange={(open) => {
          if (!loginPending) setLoginOpen(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{loginTitle}</DialogTitle>
            <DialogDescription>
              浏览和下载无需登录。使用 GitHub 登录后，可收藏图片，并在不同设备上保留你的赞踩记录。
            </DialogDescription>
          </DialogHeader>
          {loginError ? (
            <p role="alert" className="text-sm text-muted-foreground">
              {loginError}
            </p>
          ) : null}
          {!auth.user ? (
            <Button
              disabled={loginPending || !auth.loginAvailable || status !== 'ready'}
              onClick={() => void login()}
            >
              {loginPending ? '正在前往 GitHub…' : '使用 GitHub 登录'}
            </Button>
          ) : null}
          {!auth.loginAvailable ? (
            <p className="text-sm text-muted-foreground">
              GitHub 登录暂未开放，你仍可继续浏览和下载。
            </p>
          ) : null}
          <Button variant="ghost" disabled={loginPending} onClick={() => setLoginOpen(false)}>
            继续浏览
          </Button>
        </DialogContent>
      </Dialog>
    </LikesContext.Provider>
  );
}
function useReactionStore() {
  const store = useContext(LikesContext);
  if (!store) throw new Error('互动组件必须位于 LikesProvider 内。');
  return store;
}

/** Account-level readers subscribe to the shared snapshot; image buttons use the narrower hook. */
export function useLikes() {
  const store = useReactionStore();
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot);
  return {
    ...snapshot,
    refresh: store.refresh,
    requestLogin: store.requestLogin,
    logout: store.logout,
  };
}

/** Only this image's changes can notify its buttons, including when another view shows the same image. */
export function useArtworkReaction(artworkId: string) {
  const store = useReactionStore();
  const channel = store.image(artworkId);
  const snapshot = useSyncExternalStore(channel.subscribe, channel.getSnapshot);
  return {
    ...snapshot,
    refresh: store.refresh,
    toggleVote: store.toggleVote,
    toggleFavorite: store.toggleFavorite,
  };
}
