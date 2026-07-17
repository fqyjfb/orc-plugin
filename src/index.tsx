import React from 'react';
import ReactDOM from 'react-dom/client';
import { ToolPanel } from './ToolPanel';
import './index.css';

interface PluginContext {
  container: HTMLElement;
  options?: {
    theme?: 'light' | 'dark';
    width?: number;
    height?: number;
  };
}

const render = (container: HTMLElement, options?: { theme?: 'light' | 'dark' }) => {
  const root = ReactDOM.createRoot(container);
  root.render(
    <React.StrictMode>
      <ToolPanel />
    </React.StrictMode>
  );
};

const unmount = (container: HTMLElement) => {
  const root = ReactDOM.createRoot(container);
  root.unmount();
};

const plugin = {
  id: 'plugin-orc',
  name: 'OCR识别',
  version: '1.0.0',
  icon: 'Scan',
  render,
  unmount,
};

if (typeof window !== 'undefined') {
  (window as any).pluginRegistry = (window as any).pluginRegistry || {};
  (window as any).pluginRegistry[plugin.id] = plugin;
}

export default plugin;