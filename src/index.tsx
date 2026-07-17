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

let rootInstance: ReactDOM.Root | null = null;

const render = (container: HTMLElement, options?: { theme?: 'light' | 'dark' }) => {
  rootInstance = ReactDOM.createRoot(container);
  rootInstance.render(
    <React.StrictMode>
      <ToolPanel />
    </React.StrictMode>
  );
};

const unmount = (container: HTMLElement) => {
  if (rootInstance) {
    rootInstance.unmount();
    rootInstance = null;
  }
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

  const pluginData = (window as any).__PLUGIN_DATA__;
  if (pluginData) {
    const root = document.getElementById('root');
    if (root) {
      if (ReactDOM.createRoot) {
        rootInstance = ReactDOM.createRoot(root);
        rootInstance.render(<React.StrictMode><ToolPanel /></React.StrictMode>);
      } else {
        ReactDOM.render(<ToolPanel />, root);
      }
    }
  }
}

export default plugin;