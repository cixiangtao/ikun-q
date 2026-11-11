import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { LikesProvider } from './components/likes-provider';
import './index.css';

const root = document.getElementById('root');
if (!root) throw new Error('应用挂载节点不存在。');
createRoot(root).render(
  <StrictMode>
    <LikesProvider>
      <App />
    </LikesProvider>
  </StrictMode>,
);
