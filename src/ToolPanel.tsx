import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Scan, 
  Copy, 
  Trash2, 
  FileText, 
  Check, 
  Edit3, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle, 
  Play, 
  Square, 
  HelpCircle, 
  ChevronDown, 
  ChevronUp,
  Settings
} from 'lucide-react';
import { ToastContainer, Modal, LoadingSpinner } from './components';
import type { ToastItem } from './components';

interface OcrBlock {
  text: string;
  confidence: number;
  box: number[][];
}

interface OcrHistoryItem {
  id: string;
  imageBase64: string;
  text: string;
  timestamp: number;
}

interface OcrServiceStatus {
  available: boolean;
  message: string;
  status?: string;
  lastError?: string | null;
  canManualStart?: boolean;
  pid?: number;
  uptime?: number;
}

interface OcrResult {
  success: boolean;
  text: string;
  blocks: OcrBlock[];
  error?: string;
}

const MAX_HISTORY_COUNT = 20;
const PRIMARY_COLOR = '#3b82f6';
const TEXT_PRIMARY = '#111827';
const TEXT_SECONDARY = '#6b7280';
const TEXT_TERTIARY = '#9ca3af';
const ERROR_COLOR = '#dc2626';
const SUCCESS_COLOR = '#059669';
const WARNING_COLOR = '#f59e0b';

const ToolPanel: React.FC = () => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [ocrResult, setOcrResult] = useState<string>('');
  const [ocrBlocks, setOcrBlocks] = useState<OcrBlock[]>([]);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<OcrHistoryItem[]>([]);
  const [editableResult, setEditableResult] = useState<string>('');
  const [isEditing, setIsEditing] = useState(false);
  const [selectedBlockIndex, setSelectedBlockIndex] = useState<number | null>(null);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [ocrStatus, setOcrStatus] = useState<OcrServiceStatus | null>(null);
  const [confirmClearHistory, setConfirmClearHistory] = useState(false);
  const [isStartingService, setIsStartingService] = useState(false);
  const [showServiceDetails, setShowServiceDetails] = useState(false);
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [diagnoseResult, setDiagnoseResult] = useState<{ success: boolean; output: string; error?: string } | null>(null);
  const [showDiagnoseModal, setShowDiagnoseModal] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [installResult, setInstallResult] = useState<{ success: boolean; output: string; error?: string } | null>(null);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'ocr' | 'settings'>('ocr');
  const [serviceDir, setServiceDir] = useState<string>('');
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const requestIdRef = useRef(0);

  const addToast = useCallback((toast: Omit<ToastItem, 'id'>) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, ...toast }]);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  useEffect(() => {
    const pluginData = (window as any).__PLUGIN_DATA__;
    if (pluginData?.pluginDir) {
      const pythonServiceDir = pluginData.pluginDir + '/python-service';
      setServiceDir(pythonServiceDir);
    }
    checkOcrStatus();
    loadHistory();
  }, []);

  const checkOcrStatus = async () => {
    try {
      const result = await (window as any).electron?.ocr?.status();
      if (result) {
        setOcrStatus(result);
      }
    } catch (error) {
      console.error('检查OCR状态失败:', error);
      setOcrStatus({
        available: false,
        message: '检查服务状态失败',
        status: 'error',
        lastError: String(error),
        canManualStart: true,
      });
    }
  };

  const handleStartService = async () => {
    setIsStartingService(true);
    try {
      let config = { httpPort: 8766, wsPort: 8765 };
      try {
        const saved = localStorage.getItem('ocr-settings');
        if (saved) {
          const parsed = JSON.parse(saved);
          config = { httpPort: parsed.httpPort || 8766, wsPort: parsed.wsPort || 8765 };
        }
      } catch { /* ignore */ }
      const result = await (window as any).electron?.ocr?.start(serviceDir, config);
      if (result?.success) {
        addToast({ type: 'success', message: result.message });
        await checkOcrStatus();
      } else {
        addToast({ type: 'error', message: result?.message || '启动失败，请检查Python环境配置' });
        await checkOcrStatus();
      }
    } catch (error) {
      console.error('启动服务失败:', error);
      addToast({ type: 'error', message: '启动服务异常: ' + String(error) });
      await checkOcrStatus();
    } finally {
      setIsStartingService(false);
    }
  };

  const handleStopService = async () => {
    try {
      const result = await (window as any).electron?.ocr?.stop();
      if (result?.success) {
        addToast({ type: 'info', message: result.message });
        await checkOcrStatus();
      } else {
        addToast({ type: 'error', message: result?.message || '停止失败' });
      }
    } catch (error) {
      console.error('停止服务失败:', error);
      addToast({ type: 'error', message: '停止服务异常: ' + String(error) });
    }
  };

  const handleDiagnose = async () => {
    setIsDiagnosing(true);
    setShowDiagnoseModal(true);
    setDiagnoseResult(null);
    try {
      const result = await (window as any).electron?.ocr?.diagnose(serviceDir);
      const finalResult = result || { success: false, output: '', error: '诊断功能不可用' };
      setDiagnoseResult(finalResult);
      if (finalResult.success) {
        addToast({ type: 'success', message: '诊断完成，未发现问题' });
      } else {
        addToast({ type: 'warning', message: '诊断完成，发现问题请查看详情' });
      }
    } catch (error) {
      console.error('诊断失败:', error);
      setDiagnoseResult({
        success: false,
        output: '',
        error: String(error),
      });
      addToast({ type: 'error', message: '诊断运行异常' });
    } finally {
      setIsDiagnosing(false);
    }
  };

  const handleInstallDeps = async () => {
    setIsInstalling(true);
    setShowInstallModal(true);
    setInstallResult(null);
    try {
      const result = await (window as any).electron?.ocr?.installDeps(serviceDir);
      const finalResult = result || { success: false, output: '', error: '安装功能不可用' };
      setInstallResult(finalResult);
      if (finalResult.success) {
        addToast({ type: 'success', message: '依赖安装成功！现在可以启动OCR服务了' });
        await checkOcrStatus();
      } else {
        addToast({ type: 'error', message: '依赖安装失败，请查看详情' });
      }
    } catch (error) {
      console.error('安装失败:', error);
      setInstallResult({
        success: false,
        output: '',
        error: String(error),
      });
      addToast({ type: 'error', message: '依赖安装运行异常' });
    } finally {
      setIsInstalling(false);
    }
  };

  const loadHistory = () => {
    const saved = localStorage.getItem('ocr-history');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as OcrHistoryItem[];
        setHistory(parsed);
      } catch {
        console.error('解析历史记录失败');
      }
    }
  };

  const saveToHistory = useCallback((imageBase64: string, text: string) => {
    const newItem: OcrHistoryItem = {
      id: Date.now().toString(),
      imageBase64: imageBase64.substring(0, 1000),
      text,
      timestamp: Date.now(),
    };

    const newHistory = [newItem, ...history].slice(0, MAX_HISTORY_COUNT);
    setHistory(newHistory);
    localStorage.setItem('ocr-history', JSON.stringify(newHistory));
  }, [history]);

  const handleImageUpload = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      addToast({ type: 'error', message: '请上传图片文件' });
      return;
    }

    if (ocrStatus?.available === false) {
      addToast({ type: 'warning', message: 'OCR服务不可用，请先启动服务' });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setImagePreview(base64);
      setSelectedBlockIndex(null);
      performOcr(base64);
    };
    reader.readAsDataURL(file);
  }, [addToast, ocrStatus?.available]);

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setImageDimensions({ width: img.naturalWidth, height: img.naturalHeight });
  };

  const performOcr = useCallback(async (imageBase64: string) => {
    const currentRequestId = ++requestIdRef.current;

    setLoading(true);
    setOcrResult('');
    setOcrBlocks([]);
    setEditableResult('');
    setSelectedBlockIndex(null);

    try {
      const result: OcrResult = await (window as any).electron?.ocr?.recognize(imageBase64, serviceDir);

      if (currentRequestId !== requestIdRef.current) {
        return;
      }

      if (result && result.success) {
        setOcrResult(result.text);
        setEditableResult(result.text);
        setOcrBlocks(result.blocks || []);
        saveToHistory(imageBase64, result.text);
        addToast({ type: 'success', message: `识别成功，共 ${result.blocks?.length || 0} 个文字块` });
      } else {
        addToast({ type: 'error', message: result?.error || '识别失败' });
        setOcrResult('');
      }
    } catch (error) {
      if (currentRequestId !== requestIdRef.current) {
        return;
      }
      console.error('OCR识别失败:', error);
      addToast({ type: 'error', message: 'OCR识别失败，请检查服务是否正常' });
    } finally {
      if (currentRequestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [addToast, saveToHistory, serviceDir]);

  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      if (loading) {
        addToast({ type: 'info', message: '正在识别中，请稍候...' });
        return;
      }

      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            addToast({ type: 'info', message: '检测到粘贴的图片，正在识别...' });
            await handleImageUpload(file);
          }
          break;
        }
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [loading, addToast, handleImageUpload]);

  const handleCopy = async () => {
    const textToCopy = isEditing ? editableResult : ocrResult;
    if (!textToCopy) {
      addToast({ type: 'warning', message: '没有可复制的内容' });
      return;
    }

    await navigator.clipboard.writeText(textToCopy);
    addToast({ type: 'success', message: '已复制到剪贴板' });
  };

  const handleClear = () => {
    setImagePreview('');
    setOcrResult('');
    setOcrBlocks([]);
    setEditableResult('');
    setIsEditing(false);
    setSelectedBlockIndex(null);
  };

  const handleBlockClick = (index: number) => {
    setSelectedBlockIndex(selectedBlockIndex === index ? null : index);
  };

  const getBoxStyle = (box: number[][], containerWidth: number, containerHeight: number) => {
    if (!box || box.length < 4) return null;

    const xCoords = box.map((p) => p[0]);
    const yCoords = box.map((p) => p[1]);
    const minX = Math.min(...xCoords);
    const maxX = Math.max(...xCoords);
    const minY = Math.min(...yCoords);
    const maxY = Math.max(...yCoords);

    const scaleX = containerWidth / imageDimensions.width;
    const scaleY = containerHeight / imageDimensions.height;

    return {
      left: minX * scaleX,
      top: minY * scaleY,
      width: (maxX - minX) * scaleX,
      height: (maxY - minY) * scaleY,
    };
  };

  const handleHistoryClick = (item: OcrHistoryItem) => {
    setOcrResult(item.text);
    setEditableResult(item.text);
    addToast({ type: 'info', message: '已恢复历史记录的文字内容' });
  };

  const handleClearHistory = () => {
    setHistory([]);
    localStorage.removeItem('ocr-history');
    setConfirmClearHistory(false);
    addToast({ type: 'success', message: '历史记录已清空' });
  };

  const toggleEditMode = () => {
    if (isEditing) {
      setOcrResult(editableResult);
    }
    setIsEditing(!isEditing);
  };

  return (
    <div className="flex flex-col h-full min-h-full bg-white dark:bg-gray-800 overflow-hidden">
      <ToastContainer toasts={toasts} removeToast={removeToast} addToast={addToast} />

      <header className="h-14 flex-shrink-0 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            disabled={!ocrResult && !editableResult}
            className="px-3 py-1.5 text-text-secondary hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors flex items-center gap-1.5 text-sm disabled:opacity-50"
          >
            <Copy className="w-4 h-4" />
            复制结果
          </button>
          <button
            onClick={toggleEditMode}
            disabled={!ocrResult}
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 text-sm ${
              isEditing ? 'bg-blue-500 text-white' : 'text-text-secondary hover:bg-gray-100 dark:hover:bg-gray-700'
            } disabled:opacity-50`}
          >
            {isEditing ? <Check className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
            {isEditing ? '完成编辑' : '编辑结果'}
          </button>
          <button
            onClick={handleClear}
            className="px-3 py-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors flex items-center gap-1.5 text-sm"
          >
            <Trash2 className="w-4 h-4" />
            清空
          </button>
        </div>
        <div className="flex items-center gap-2">
          {ocrStatus === null && (
            <span className="text-xs text-text-tertiary flex items-center gap-1">
              <RefreshCw className="w-3 h-3 animate-spin" />
              检查服务状态...
            </span>
          )}
          {ocrStatus !== null && (
            <div className="flex items-center gap-2">
              <div className={`px-2 py-1 rounded-full text-xs flex items-center gap-1.5 ${
                ocrStatus.available ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
              }`}>
                {ocrStatus.available ? (
                  <CheckCircle className="w-3 h-3" />
                ) : (
                  <AlertCircle className="w-3 h-3" />
                )}
                {ocrStatus.available ? '服务就绪' : '服务未运行'}
              </div>
              
              {ocrStatus.canManualStart && (
                <button
                  onClick={handleStartService}
                  disabled={isStartingService}
                  className="px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded-lg transition-colors flex items-center gap-1 disabled:opacity-50"
                >
                  {isStartingService ? (
                    <RefreshCw className="w-3 h-3 animate-spin" />
                  ) : (
                    <Play className="w-3 h-3" />
                  )}
                  {isStartingService ? '启动中...' : '启动服务'}
                </button>
              )}
              
              {!ocrStatus.canManualStart && ocrStatus.available && (
                <button
                  onClick={handleStopService}
                  className="px-2 py-1 bg-amber-100 hover:bg-amber-200 text-amber-600 text-xs rounded-lg transition-colors flex items-center gap-1"
                >
                  <Square className="w-3 h-3" />
                  停止服务
                </button>
              )}

              <button
                onClick={() => setShowServiceDetails(!showServiceDetails)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                title="服务详情"
              >
                {showServiceDetails ? <ChevronUp className="w-4 h-4 text-text-tertiary" /> : <ChevronDown className="w-4 h-4 text-text-tertiary" />}
              </button>
            </div>
          )}
        </div>
      </header>

      {showServiceDetails && ocrStatus && (
        <div className="bg-gray-100/50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <HelpCircle className="w-3 h-3 text-text-tertiary" />
              <span className="text-text-tertiary">服务状态:</span>
              <span className={`font-medium ${
                ocrStatus.status === 'running' ? 'text-green-600' :
                ocrStatus.status === 'starting' ? 'text-amber-600' :
                ocrStatus.status === 'error' ? 'text-red-600' : 'text-text-secondary'
              }`}>
                {ocrStatus.status === 'running' ? '运行中' :
                 ocrStatus.status === 'starting' ? '启动中' :
                 ocrStatus.status === 'stopping' ? '停止中' :
                 ocrStatus.status === 'error' ? '异常' : '已停止'}
              </span>
            </div>
            {ocrStatus.pid && (
              <div className="flex items-center gap-1.5">
                <span className="text-text-tertiary">PID:</span>
                <span className="font-mono">{ocrStatus.pid}</span>
              </div>
            )}
            {ocrStatus.uptime !== undefined && ocrStatus.uptime !== null && (
              <div className="flex items-center gap-1.5">
                <span className="text-text-tertiary">运行时间:</span>
                <span>{Math.floor(ocrStatus.uptime / 60)}分{ocrStatus.uptime % 60}秒</span>
              </div>
            )}
            {ocrStatus.lastError && (
              <div className="flex-1 flex items-center gap-1.5">
                <AlertCircle className="w-3 h-3 text-red-500" />
                <span className="text-red-500 truncate max-w-xs" title={ocrStatus.lastError}>
                  错误: {ocrStatus.lastError}
                </span>
              </div>
            )}
          </div>
          {ocrStatus.lastError && (
              <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded text-xs text-red-600">
                <div className="font-medium mb-1">常见解决方法:</div>
                <ul className="list-disc list-inside space-y-1">
                  <li>检查Python环境是否正确安装（建议Python 3.8+）</li>
                  <li>确保已安装所需依赖：pip install -r requirements.txt</li>
                  <li>检查端口8766是否被其他程序占用</li>
                  <li>尝试重启应用后再次启动服务</li>
                </ul>
                <div className="flex gap-2">
                  <button
                    onClick={handleDiagnose}
                    disabled={isDiagnosing}
                    className="mt-2 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {isDiagnosing ? (
                      <RefreshCw className="w-3 h-3 animate-spin" />
                    ) : (
                        <HelpCircle className="w-3 h-3" />
                      )}
                    {isDiagnosing ? '诊断中...' : '运行诊断'}
                  </button>
                  <button
                    onClick={handleInstallDeps}
                    disabled={isInstalling}
                    className="mt-2 px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-xs rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {isInstalling ? (
                      <RefreshCw className="w-3 h-3 animate-spin" />
                    ) : (
                      <Play className="w-3 h-3" />
                    )}
                    {isInstalling ? '安装中...' : '安装依赖'}
                  </button>
                </div>
              </div>
            )}
        </div>
      )}

      <div className="flex border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab('ocr')}
          className={`flex-1 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
            activeTab === 'ocr'
              ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50 dark:bg-blue-900/20'
              : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <Scan className="w-4 h-4" />
          OCR识别
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`flex-1 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
            activeTab === 'settings'
              ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50 dark:bg-blue-900/20'
              : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <Settings className="w-4 h-4" />
          设置
        </button>
      </div>

      {activeTab === 'ocr' && (
        <div className="flex-1 flex overflow-hidden">
          <div className="w-1/2 flex flex-col border-r border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between px-4 py-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              <span className="text-[11px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-widest">
                上传图片
              </span>
            </div>
            <div className="flex-1 flex flex-col p-4 overflow-auto">
              {!imagePreview ? (
                <div
                  className="bg-gray-50 dark:bg-gray-900 border-2 border-dashed border-gray-300 dark:border-gray-600 h-full flex flex-col items-center justify-center cursor-pointer hover:border-blue-500 transition-colors"
                  onClick={() => document.getElementById('file-input')?.click()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files[0];
                    if (file && file.type.startsWith('image/')) {
                      handleImageUpload(file);
                    }
                  }}
                  onDragOver={(e) => e.preventDefault()}
                >
                  <Scan className="w-16 h-16 text-blue-500 mb-4" />
                  <p className="text-gray-600 dark:text-gray-400 mb-1">点击或拖拽图片到此处</p>
                  <p className="text-text-tertiary text-xs">支持 PNG、JPG、BMP、WEBP 格式</p>
                  <p className="text-text-tertiary text-xs mt-1">或使用 Ctrl/Cmd+V 粘贴剪贴板图片</p>
                </div>
              ) : (
                <div
                  ref={imageContainerRef}
                  className="flex-1 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden flex items-center justify-center relative"
                >
                  <img
                    src={imagePreview}
                    alt="预览"
                    className="max-w-full max-h-full object-contain"
                    onLoad={handleImageLoad}
                  />

                  {imageDimensions.width > 0 &&
                    selectedBlockIndex !== null &&
                    imageContainerRef.current &&
                    ocrBlocks[selectedBlockIndex] && (() => {
                      const containerRect = imageContainerRef.current?.getBoundingClientRect();
                      if (!containerRect) return null;

                      const containerAspect = containerRect.width / containerRect.height;
                      const imageAspect = imageDimensions.width / imageDimensions.height;

                      let displayWidth, displayHeight, offsetX, offsetY;
                      if (imageAspect > containerAspect) {
                        displayWidth = containerRect.width;
                        displayHeight = containerRect.width / imageAspect;
                        offsetX = 0;
                        offsetY = (containerRect.height - displayHeight) / 2;
                      } else {
                        displayHeight = containerRect.height;
                        displayWidth = containerRect.height * imageAspect;
                        offsetX = (containerRect.width - displayWidth) / 2;
                        offsetY = 0;
                      }

                      const block = ocrBlocks[selectedBlockIndex];
                      const boxStyle = getBoxStyle(block.box, displayWidth, displayHeight);
                      if (!boxStyle) return null;

                      return (
                        <div key={selectedBlockIndex} className="absolute inset-0 pointer-events-none">
                          <div
                            className="absolute border-2 border-blue-500 bg-blue-500/20 shadow-lg shadow-blue-500/30 transition-all duration-200"
                            style={{
                              left: offsetX + boxStyle.left,
                              top: offsetY + boxStyle.top,
                              width: boxStyle.width,
                              height: boxStyle.height,
                            }}
                          >
                            <div className="absolute -top-4 left-0 text-[10px] px-1.5 rounded bg-blue-500 text-white">
                              {selectedBlockIndex + 1}
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                  {loading && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <LoadingSpinner />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="w-1/2 flex flex-col">
            <div className="flex items-center justify-between px-4 py-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              <span className="text-[11px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-widest">
                识别结果
              </span>
              {loading && (
                <span className="text-xs text-blue-600 flex items-center gap-1">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  识别中...
                </span>
              )}
              {ocrBlocks.length > 0 && !loading && (
                <span className="text-xs text-text-tertiary">
                  {ocrBlocks.length} 个文字块
                </span>
              )}
            </div>
            <div className="flex-1 overflow-auto p-4">
              {ocrResult || editableResult ? (
                <div className="h-full">
                  {isEditing ? (
                    <textarea
                      value={editableResult}
                      onChange={(e) => setEditableResult(e.target.value)}
                      className="w-full h-full resize-none bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-3 text-sm font-mono text-gray-800 dark:text-gray-200"
                      placeholder="编辑识别结果..."
                    />
                  ) : (
                    <div className="space-y-2">
                      {ocrBlocks.length > 0 && (
                        <div className="mb-3 p-2 bg-gray-100 dark:bg-gray-700/50 rounded text-xs max-h-48 overflow-auto">
                          <div className="text-text-tertiary mb-2 sticky top-0 bg-gray-100 dark:bg-gray-700/50">
                            识别详情（点击高亮对应区域）：
                          </div>
                          <div className="space-y-1">
                            {ocrBlocks.map((block, index) => (
                              <div
                                key={index}
                                onClick={() => handleBlockClick(index)}
                                className={`flex items-center gap-2 p-1.5 rounded cursor-pointer transition-colors ${
                                  selectedBlockIndex === index
                                    ? 'bg-blue-100 dark:bg-blue-900/40 border border-blue-500'
                                    : 'hover:bg-gray-200 dark:hover:bg-gray-600 border border-transparent'
                                }`}
                              >
                                <span
                                  className={`w-5 h-5 flex items-center justify-center text-[10px] rounded ${
                                    selectedBlockIndex === index
                                      ? 'bg-blue-500 text-white'
                                      : 'bg-green-500 text-white'
                                  }`}
                                >
                                  {index + 1}
                                </span>
                                <span className="text-text-secondary flex-1 truncate">
                                  {block.text.substring(0, 40)}
                                  {block.text.length > 40 ? '...' : ''}
                                </span>
                                <span
                                  className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 ${
                                    block.confidence > 0.9
                                      ? 'bg-green-100 text-green-600'
                                      : block.confidence > 0.7
                                      ? 'bg-amber-100 text-amber-600'
                                      : 'bg-red-100 text-red-600'
                                  }`}
                                >
                                  {(block.confidence * 100).toFixed(0)}%
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      <pre className="text-sm font-mono text-gray-800 dark:text-gray-200 whitespace-pre-wrap bg-gray-50 dark:bg-gray-900 p-3 rounded-lg border border-gray-200 dark:border-gray-700 max-h-64 overflow-auto">
                        {ocrResult}
                      </pre>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
                  <div className="text-center">
                    <FileText className="w-16 h-16 opacity-50 mx-auto mb-4" />
                    <p>识别结果将显示在这里</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="flex-1 overflow-auto p-4">
          <OcrSettingsPanel addToast={addToast} checkOcrStatus={checkOcrStatus} />
        </div>
      )}

      {history.length > 0 && activeTab === 'ocr' && (
        <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <div className="flex items-center justify-between px-4 py-2">
            <span className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-widest">
              历史记录 ({history.length})
            </span>
            <button
              onClick={() => setConfirmClearHistory(true)}
              className="text-xs text-red-500 hover:underline"
            >
              清空历史
            </button>
          </div>
          <div className="flex gap-2 px-4 pb-3 overflow-x-auto">
            {history.slice(0, 10).map((item) => (
              <button
                key={item.id}
                onClick={() => handleHistoryClick(item)}
                className="flex-shrink-0 p-2 bg-gray-100 dark:bg-gray-800 hover:bg-white dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg transition-colors text-left"
                style={{ minWidth: 120 }}
              >
                <div className="text-xs text-gray-600 dark:text-gray-400 truncate">
                  {item.text.substring(0, 30)}
                  {item.text.length > 30 ? '...' : ''}
                </div>
                <div className="text-[10px] text-gray-500 dark:text-gray-500 mt-1">
                  {new Date(item.timestamp).toLocaleString()}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <input
        id="file-input"
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            handleImageUpload(file);
          }
        }}
      />

      <Modal
        title="确认清空"
        isOpen={confirmClearHistory}
        onClose={() => setConfirmClearHistory(false)}
        onConfirm={handleClearHistory}
      >
        <p>确定要清空所有历史记录吗？</p>
      </Modal>

      <Modal
        title="OCR 服务诊断结果"
        isOpen={showDiagnoseModal}
        onClose={() => setShowDiagnoseModal(false)}
        showCancel={false}
        showConfirm={false}
      >
        {isDiagnosing ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-6 h-6 animate-spin text-blue-500 mr-3" />
            <span>正在运行诊断...</span>
          </div>
        ) : diagnoseResult ? (
          <div className="space-y-4">
            <div className={`p-3 rounded-lg text-sm ${diagnoseResult.success ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
              {diagnoseResult.success ? '✓ 诊断通过，未发现问题' : '✗ 诊断完成，发现问题'}
            </div>
            {diagnoseResult.output && (
              <div className="bg-gray-100 dark:bg-gray-900 p-3 rounded-lg max-h-96 overflow-auto">
                <pre className="text-xs font-mono whitespace-pre-wrap text-gray-800 dark:text-gray-200">
                  {diagnoseResult.output}
                </pre>
              </div>
            )}
            {diagnoseResult.error && (
              <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
                <div className="text-xs font-medium text-red-600 mb-1">错误信息:</div>
                <pre className="text-xs font-mono text-red-600">
                  {diagnoseResult.error}
                </pre>
              </div>
            )}
          </div>
        ) : null}
      </Modal>

      <Modal
        title="安装 Python 依赖"
        isOpen={showInstallModal}
        onClose={() => setShowInstallModal(false)}
        showCancel={false}
        showConfirm={false}
      >
        {isInstalling ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-6 h-6 animate-spin text-green-500 mr-3" />
            <span>正在安装依赖，这可能需要几分钟...</span>
          </div>
        ) : installResult ? (
          <div className="space-y-4">
            <div className={`p-3 rounded-lg text-sm ${installResult.success ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
              {installResult.success ? '✓ 依赖安装成功！' : '✗ 依赖安装失败'}
            </div>
            {installResult.output && (
              <div className="bg-gray-100 dark:bg-gray-900 p-3 rounded-lg max-h-96 overflow-auto">
                <pre className="text-xs font-mono whitespace-pre-wrap text-gray-800 dark:text-gray-200">
                  {installResult.output}
                </pre>
              </div>
            )}
            {installResult.error && (
              <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
                <div className="text-xs font-medium text-red-600 mb-1">错误信息:</div>
                <pre className="text-xs font-mono text-red-600">
                  {installResult.error}
                </pre>
              </div>
            )}
          </div>
        ) : null}
      </Modal>
    </div>
  );
};

interface OcrSettings {
  httpPort: number;
  wsPort: number;
  idleTimeoutMinutes: number;
  autoRestart: boolean;
  maxRestarts: number;
  pythonPath: string;
}

const DEFAULT_OCR_SETTINGS: OcrSettings = {
  httpPort: 8766,
  wsPort: 8765,
  idleTimeoutMinutes: 10,
  autoRestart: true,
  maxRestarts: 3,
  pythonPath: '',
};

interface OcrSettingsPanelProps {
  addToast: (toast: Omit<ToastItem, 'id'>) => void;
  checkOcrStatus: () => void;
}

const OcrSettingsPanel: React.FC<OcrSettingsPanelProps> = ({ addToast, checkOcrStatus }) => {
  const [settings, setSettings] = useState<OcrSettings>(DEFAULT_OCR_SETTINGS);
  const [serviceStatus, setServiceStatus] = useState<OcrServiceStatus | null>(null);
  const [isStartingService, setIsStartingService] = useState(false);
  const [isCheckingPort, setIsCheckingPort] = useState(false);
  const [portCheckResults, setPortCheckResults] = useState<{ [key: string]: boolean | null }>({});
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [diagnoseResult, setDiagnoseResult] = useState<{ success: boolean; output: string; error?: string } | null>(null);
  const [showDiagnoseModal, setShowDiagnoseModal] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [installResult, setInstallResult] = useState<{ success: boolean; output: string; error?: string } | null>(null);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [serviceDir, setServiceDir] = useState<string>('');

  useEffect(() => {
    const pluginData = (window as any).__PLUGIN_DATA__;
    if (pluginData?.pluginDir) {
      setServiceDir(pluginData.pluginDir + '/python-service');
    }
    const saved = localStorage.getItem('ocr-settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as OcrSettings;
        setSettings({ ...DEFAULT_OCR_SETTINGS, ...parsed });
      } catch {
        console.error('解析OCR设置失败');
      }
    }
    checkServiceStatus();
  }, []);

  const checkServiceStatus = async () => {
    try {
      const result = await (window as any).electron?.ocr?.status();
      if (result) {
        setServiceStatus(result);
      }
    } catch (error) {
      console.error('检查OCR状态失败:', error);
      setServiceStatus({
        available: false,
        message: '检查服务状态失败',
        status: 'error',
        lastError: String(error),
        canManualStart: true,
      });
    }
  };

  const saveSettings = (newSettings: OcrSettings) => {
    localStorage.setItem('ocr-settings', JSON.stringify(newSettings));
    setSettings(newSettings);
    setHasUnsavedChanges(false);
    addToast({ type: 'success', message: 'OCR设置已保存' });
  };

  const handleSettingChange = <K extends keyof OcrSettings>(key: K, value: OcrSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setHasUnsavedChanges(true);
  };

  const handleStartService = async () => {
    setIsStartingService(true);
    try {
      if (hasUnsavedChanges) {
        addToast({ type: 'warning', message: '有未保存的设置，请先保存后再启动服务' });
        setIsStartingService(false);
        return;
      }
      const result = await (window as any).electron?.ocr?.start(serviceDir, {
        httpPort: settings.httpPort,
        wsPort: settings.wsPort,
        pythonPath: settings.pythonPath,
        autoRestart: settings.autoRestart,
        maxRestarts: settings.maxRestarts,
      });
      if (result?.success) {
        addToast({ type: 'success', message: result.message });
        await checkServiceStatus();
        checkOcrStatus();
      } else {
        addToast({ type: 'error', message: result?.message || '启动失败，请检查Python环境配置' });
        await checkServiceStatus();
        checkOcrStatus();
      }
    } catch (error) {
      console.error('启动服务失败:', error);
      addToast({ type: 'error', message: '启动服务异常: ' + String(error) });
      await checkServiceStatus();
      checkOcrStatus();
    } finally {
      setIsStartingService(false);
    }
  };

  const handleStopService = async () => {
    try {
      const result = await (window as any).electron?.ocr?.stop();
      if (result?.success) {
        addToast({ type: 'info', message: result.message });
        await checkServiceStatus();
        checkOcrStatus();
      } else {
        addToast({ type: 'error', message: result?.message || '停止失败' });
      }
    } catch (error) {
      console.error('停止服务失败:', error);
      addToast({ type: 'error', message: '停止服务异常: ' + String(error) });
    }
  };

  const handleCheckPort = async (port: number, portType: 'http' | 'ws') => {
    setIsCheckingPort(true);
    setPortCheckResults(prev => ({ ...prev, [`${portType}-${port}`]: null }));
    try {
      const result = await (window as any).electron?.ocr?.checkPort(port);
      if (result?.success) {
        setPortCheckResults(prev => ({ ...prev, [`${portType}-${port}`]: result.inUse }));
        if (result.inUse) {
          addToast({ type: 'warning', message: `端口 ${port} 已被占用` });
        }
      }
    } catch (error) {
      console.error('检查端口失败:', error);
      addToast({ type: 'error', message: '检查端口失败' });
    } finally {
      setIsCheckingPort(false);
    }
  };

  const handleDiagnose = async () => {
    setIsDiagnosing(true);
    setShowDiagnoseModal(true);
    setDiagnoseResult(null);
    try {
      const result = await (window as any).electron?.ocr?.diagnose(serviceDir);
      const finalResult = result || { success: false, output: '', error: '诊断功能不可用' };
      setDiagnoseResult(finalResult);
      if (finalResult.success) {
        addToast({ type: 'success', message: '诊断完成，未发现问题' });
      } else {
        addToast({ type: 'warning', message: '诊断完成，发现问题请查看详情' });
      }
    } catch (error) {
      console.error('诊断失败:', error);
      setDiagnoseResult({
        success: false,
        output: '',
        error: String(error),
      });
      addToast({ type: 'error', message: '诊断运行异常' });
    } finally {
      setIsDiagnosing(false);
    }
  };

  const handleInstallDeps = async () => {
    setIsInstalling(true);
    setShowInstallModal(true);
    setInstallResult(null);
    try {
      const result = await (window as any).electron?.ocr?.installDeps(serviceDir);
      const finalResult = result || { success: false, output: '', error: '安装功能不可用' };
      setInstallResult(finalResult);
      if (finalResult.success) {
        addToast({ type: 'success', message: '依赖安装成功！现在可以启动OCR服务了' });
        await checkServiceStatus();
        checkOcrStatus();
      } else {
        addToast({ type: 'error', message: '依赖安装失败，请查看详情' });
      }
    } catch (error) {
      console.error('安装失败:', error);
      setInstallResult({
        success: false,
        output: '',
        error: String(error),
      });
      addToast({ type: 'error', message: '依赖安装运行异常' });
    } finally {
      setIsInstalling(false);
    }
  };

  const handleSelectPythonPath = async () => {
    try {
      const result = await (window as any).electron?.ocr?.selectPythonPath();
      if (result?.success && result.path) {
        handleSettingChange('pythonPath', result.path);
        addToast({ type: 'success', message: '已选择Python解释器' });
      }
    } catch (error) {
      console.error('选择Python路径失败:', error);
      addToast({ type: 'error', message: '选择Python路径失败' });
    }
  };

  const handleSave = () => {
    if (serviceStatus?.available) {
      addToast({ type: 'warning', message: '请先停止服务后再保存设置' });
      return;
    }
    saveSettings(settings);
  };

  const handleReset = () => {
    setSettings(DEFAULT_OCR_SETTINGS);
    setHasUnsavedChanges(true);
    addToast({ type: 'info', message: '已重置为默认设置，请保存' });
  };

  const getPortCheckIcon = (portType: 'http' | 'ws', port: number) => {
    const key = `${portType}-${port}`;
    const result = portCheckResults[key];
    if (result === null) return null;
    if (result === false) return <CheckCircle className="w-4 h-4 text-green-500" />;
    if (result === true) return <AlertCircle className="w-4 h-4 text-red-500" />;
    return null;
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="flex items-center p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">OCR识别设置</h2>
      </div>

      <div className="divide-y divide-gray-100 dark:divide-gray-700">
        <div className="flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-700 dark:text-gray-300">服务状态</span>
            {serviceStatus === null ? (
              <span className="text-xs text-text-tertiary flex items-center gap-1">
                <RefreshCw className="w-3 h-3 animate-spin" />
                检查中...
              </span>
            ) : (
              <div className={`px-2 py-0.5 rounded-full text-xs flex items-center gap-1 ${
                serviceStatus.available ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
              }`}>
                {serviceStatus.available ? (
                  <CheckCircle className="w-3 h-3" />
                ) : (
                  <AlertCircle className="w-3 h-3" />
                )}
                {serviceStatus.available ? '运行中' : '已停止'}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {serviceStatus?.canManualStart && !serviceStatus.available && (
              <button
                onClick={handleStartService}
                disabled={isStartingService || hasUnsavedChanges}
                className="px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded-md transition-colors flex items-center gap-1 disabled:opacity-50"
              >
                {isStartingService ? (
                  <RefreshCw className="w-3 h-3 animate-spin" />
                ) : (
                  <Play className="w-3 h-3" />
                )}
                {isStartingService ? '启动中...' : '启动'}
              </button>
            )}
            {serviceStatus?.available && (
              <button
                onClick={handleStopService}
                className="px-2 py-1 bg-amber-100 hover:bg-amber-200 text-amber-600 text-xs rounded-md transition-colors flex items-center gap-1"
              >
                <Square className="w-3 h-3" />
                停止
              </button>
            )}
            <button
              onClick={checkServiceStatus}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
              title="刷新状态"
            >
              <RefreshCw className="w-3 h-3 text-gray-500" />
            </button>
          </div>
        </div>

        <div className="px-3 py-2">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm text-gray-700 dark:text-gray-300">端口配置</span>
            {serviceStatus?.available && (
              <span className="text-xs text-amber-600">（运行中，修改需停止服务）</span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">HTTP 端口</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  value={settings.httpPort}
                  onChange={(e) => handleSettingChange('httpPort', parseInt(e.target.value) || 0)}
                  className="w-16 px-2 py-0.5 text-xs border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                  min="1"
                  max="65535"
                />
                <button
                  onClick={() => handleCheckPort(settings.httpPort, 'http')}
                  disabled={isCheckingPort}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                  title="检测端口"
                >
                  {isCheckingPort ? (
                    <RefreshCw className="w-3 h-3 text-gray-400 animate-spin" />
                  ) : (
                    getPortCheckIcon('http', settings.httpPort) || <RefreshCw className="w-3 h-3 text-gray-400" />
                  )}
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">WebSocket 端口</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  value={settings.wsPort}
                  onChange={(e) => handleSettingChange('wsPort', parseInt(e.target.value) || 0)}
                  className="w-16 px-2 py-0.5 text-xs border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                  min="1"
                  max="65535"
                />
                <button
                  onClick={() => handleCheckPort(settings.wsPort, 'ws')}
                  disabled={isCheckingPort}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                  title="检测端口"
                >
                  {isCheckingPort ? (
                    <RefreshCw className="w-3 h-3 text-gray-400 animate-spin" />
                  ) : (
                    getPortCheckIcon('ws', settings.wsPort) || <RefreshCw className="w-3 h-3 text-gray-400" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-sm text-gray-700 dark:text-gray-300">空闲超时（分钟）</span>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={settings.idleTimeoutMinutes}
              onChange={(e) => handleSettingChange('idleTimeoutMinutes', parseInt(e.target.value) || 0)}
              className="w-16 px-2 py-0.5 text-xs border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
              min="1"
              max="60"
            />
            <span className="text-xs text-gray-500">{settings.idleTimeoutMinutes} 分钟后自动停止</span>
          </div>
        </div>

        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-sm text-gray-700 dark:text-gray-300">自动重启</span>
          <button
            onClick={() => handleSettingChange('autoRestart', !settings.autoRestart)}
            className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${
              settings.autoRestart ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'
            }`}
          >
            <span
              className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${
                settings.autoRestart ? 'translate-x-7' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {settings.autoRestart && (
          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-sm text-gray-700 dark:text-gray-300">最大重启次数</span>
            <input
              type="number"
              value={settings.maxRestarts}
              onChange={(e) => handleSettingChange('maxRestarts', parseInt(e.target.value) || 0)}
              className="w-16 px-2 py-0.5 text-xs border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
              min="0"
              max="10"
            />
          </div>
        )}

        <div className="px-3 py-2">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm text-gray-700 dark:text-gray-300">Python 解释器路径</span>
            <span className="text-xs text-gray-500">（留空使用系统默认）</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={settings.pythonPath}
              onChange={(e) => handleSettingChange('pythonPath', e.target.value)}
              className="flex-1 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
              placeholder="例如: C:\Python39\python.exe"
            />
            <button
              onClick={handleSelectPythonPath}
              className="px-2 py-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 text-xs rounded-md transition-colors"
            >
              浏览
            </button>
          </div>
        </div>

        <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700/50">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">故障排查</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleDiagnose}
              disabled={isDiagnosing}
              className="px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded-md transition-colors flex items-center gap-1 disabled:opacity-50"
            >
              {isDiagnosing ? (
                <RefreshCw className="w-3 h-3 animate-spin" />
              ) : (
                <HelpCircle className="w-3 h-3" />
              )}
              {isDiagnosing ? '诊断中...' : '运行诊断'}
            </button>
            <button
              onClick={handleInstallDeps}
              disabled={isInstalling}
              className="px-2 py-1 bg-green-500 hover:bg-green-600 text-white text-xs rounded-md transition-colors flex items-center gap-1 disabled:opacity-50"
            >
              {isInstalling ? (
                <RefreshCw className="w-3 h-3 animate-spin" />
              ) : (
                <Play className="w-3 h-3" />
              )}
              {isInstalling ? '安装中...' : '安装依赖'}
            </button>
          </div>
        </div>

        <div className="px-3 py-2 flex items-center justify-between border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleReset}
            className="px-2 py-1 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
          >
            重置默认
          </button>
          <div className="flex items-center gap-2">
            {hasUnsavedChanges && (
              <span className="text-xs text-amber-600">有未保存的更改</span>
            )}
            <button
              onClick={handleSave}
              disabled={!hasUnsavedChanges || serviceStatus?.available}
              className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              保存设置
            </button>
          </div>
        </div>
      </div>

      <Modal
        title="OCR 服务诊断结果"
        isOpen={showDiagnoseModal}
        onClose={() => setShowDiagnoseModal(false)}
        showCancel={false}
        showConfirm={false}
      >
        <div className="max-h-96 overflow-auto">
          {isDiagnosing ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-6 h-6 animate-spin text-blue-500 mr-3" />
              <span className="text-gray-600 dark:text-gray-400">正在运行诊断...</span>
            </div>
          ) : diagnoseResult ? (
            <div className="space-y-4">
              <div className={`p-3 rounded-lg text-sm ${diagnoseResult.success ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                {diagnoseResult.success ? '✓ 诊断通过，未发现问题' : '✗ 诊断完成，发现问题'}
              </div>
              {diagnoseResult.output && (
                <div className="bg-gray-100 dark:bg-gray-900 p-3 rounded-lg">
                  <pre className="text-xs font-mono whitespace-pre-wrap text-gray-700 dark:text-gray-300">
                    {diagnoseResult.output}
                  </pre>
                </div>
              )}
              {diagnoseResult.error && (
                <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
                  <div className="text-xs font-medium text-red-600 mb-1">错误信息:</div>
                  <pre className="text-xs font-mono text-red-600">
                    {diagnoseResult.error}
                  </pre>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </Modal>

      <Modal
        title="安装 Python 依赖"
        isOpen={showInstallModal}
        onClose={() => setShowInstallModal(false)}
        showCancel={false}
        showConfirm={false}
      >
        <div className="max-h-96 overflow-auto">
          {isInstalling ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-6 h-6 animate-spin text-green-500 mr-3" />
              <span className="text-gray-600 dark:text-gray-400">正在安装依赖，这可能需要几分钟...</span>
            </div>
          ) : installResult ? (
            <div className="space-y-4">
              <div className={`p-3 rounded-lg text-sm ${installResult.success ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                {installResult.success ? '✓ 依赖安装成功！' : '✗ 依赖安装失败'}
              </div>
              {installResult.output && (
                <div className="bg-gray-100 dark:bg-gray-900 p-3 rounded-lg">
                  <pre className="text-xs font-mono whitespace-pre-wrap text-gray-700 dark:text-gray-300">
                    {installResult.output}
                  </pre>
                </div>
              )}
              {installResult.error && (
                <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
                  <div className="text-xs font-medium text-red-600 mb-1">错误信息:</div>
                  <pre className="text-xs font-mono text-red-600">
                    {installResult.error}
                  </pre>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </Modal>
    </div>
  );
};

export { ToolPanel };