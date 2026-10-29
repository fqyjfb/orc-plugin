import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Scan,
  Copy,
  Trash2,
  FileText,
  Check,
  Edit3,
  RefreshCw,
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

interface OcrResult {
  success: boolean;
  text: string;
  blocks: OcrBlock[];
  error?: string;
}

const MAX_HISTORY_COUNT = 20;
const THEME_COLOR = '#3b82f6';
const TEXT_PRIMARY = '#111827';
const TEXT_SECONDARY = '#6b7280';
const TEXT_TERTIARY = '#9ca3af';

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
  const [confirmClearHistory, setConfirmClearHistory] = useState(false);
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
    loadHistory();
  }, []);

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

  const performOcr = useCallback(async (imageBase64: string) => {
    const currentRequestId = ++requestIdRef.current;
    setLoading(true);
    setOcrResult('');
    setOcrBlocks([]);
    setEditableResult('');
    setSelectedBlockIndex(null);

    try {
      const result: OcrResult = await (window as any).electron?.ocr?.recognize(imageBase64);
      if (currentRequestId !== requestIdRef.current) return;
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
      if (currentRequestId !== requestIdRef.current) return;
      console.error('OCR识别失败:', error);
      addToast({ type: 'error', message: 'OCR识别失败' });
    } finally {
      if (currentRequestId === requestIdRef.current) setLoading(false);
    }
  }, [addToast, saveToHistory]);

  const handleImageUpload = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      addToast({ type: 'error', message: '请上传图片文件' });
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
  }, [addToast, performOcr]);

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setImageDimensions({ width: img.naturalWidth, height: img.naturalHeight });
  };

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

  const getConfidenceStyle = (confidence: number) => {
    if (confidence > 0.9) return { bg: '#d1fae5', text: '#065f46' };
    if (confidence > 0.7) return { bg: '#fef3c7', text: '#92400e' };
    return { bg: '#fee2e2', text: '#991b1b' };
  };

  return (
    <div className="flex flex-col h-full min-h-full bg-white overflow-hidden">
      <ToastContainer toasts={toasts} removeToast={removeToast} addToast={addToast} />

      <header className="h-14 flex-shrink-0 border-b border-gray-200 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            disabled={!ocrResult && !editableResult}
            className="px-3 py-1.5 text-white hover:opacity-90 rounded-lg transition-opacity flex items-center gap-1.5 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ backgroundColor: THEME_COLOR }}
          >
            <Copy className="w-4 h-4" />
            复制结果
          </button>
          <button
            onClick={toggleEditMode}
            disabled={!ocrResult}
            className={`px-3 py-1.5 rounded-lg transition-opacity flex items-center gap-1.5 text-sm disabled:opacity-40 disabled:cursor-not-allowed ${
              isEditing ? 'text-white' : 'text-white'
            }`}
            style={isEditing ? { backgroundColor: THEME_COLOR } : { backgroundColor: THEME_COLOR }}
          >
            {isEditing ? <Check className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
            {isEditing ? '完成编辑' : '编辑结果'}
          </button>
          <button
            onClick={handleClear}
            className="px-3 py-1.5 text-white hover:opacity-90 rounded-lg transition-opacity flex items-center gap-1.5 text-sm"
            style={{ backgroundColor: '#ef4444' }}
          >
            <Trash2 className="w-4 h-4" />
            清空
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-1/2 flex flex-col border-r border-gray-200">
          <div className="flex items-center justify-between px-4 py-2 bg-gray-100 border-b border-gray-200">
            <span className="text-[11px] font-bold text-gray-600 uppercase tracking-widest">
              上传图片
            </span>
          </div>
          <div className="flex-1 flex flex-col p-4 overflow-auto">
            {!imagePreview ? (
              <div
                className="bg-gray-50 border-2 border-dashed h-full flex flex-col items-center justify-center cursor-pointer transition-colors"
                style={{ borderColor: '#d1d5db' }}
                onClick={() => document.getElementById('file-input')?.click()}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files[0];
                  if (file && file.type.startsWith('image/')) {
                    handleImageUpload(file);
                  }
                }}
                onDragOver={(e) => e.preventDefault()}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = THEME_COLOR;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = '#d1d5db';
                }}
              >
                <Scan className="w-16 h-16 mb-4" style={{ color: THEME_COLOR }} />
                <p className="text-gray-600 mb-1">点击或拖拽图片到此处</p>
                <p className="text-text-tertiary text-xs">支持 PNG、JPG、BMP、WEBP 格式</p>
                <p className="text-text-tertiary text-xs mt-1">或使用 Ctrl/Cmd+V 粘贴剪贴板图片</p>
              </div>
            ) : (
              <div
                ref={imageContainerRef}
                className="flex-1 bg-gray-50 border border-gray-200 rounded-lg overflow-hidden flex items-center justify-center relative"
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
                    const containerRect = imageContainerRef.current.getBoundingClientRect();
                    if (!containerRect) return null;
                    const containerAspect = containerRect.width / containerRect.height;
                    const imageAspect = imageDimensions.width / imageDimensions.height;
                    let displayWidth: number, displayHeight: number, offsetX: number, offsetY: number;
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
                          className="absolute transition-all duration-200"
                          style={{
                            left: offsetX + boxStyle.left,
                            top: offsetY + boxStyle.top,
                            width: boxStyle.width,
                            height: boxStyle.height,
                            border: `2px solid ${THEME_COLOR}`,
                            backgroundColor: `${THEME_COLOR}33`,
                            boxShadow: `0 0 0 1px ${THEME_COLOR}33`,
                          }}
                        >
                          <div
                            className="absolute -top-4 left-0 text-[10px] px-1.5 rounded text-white"
                            style={{ backgroundColor: THEME_COLOR }}
                          >
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
          <div className="flex items-center justify-between px-4 py-2 bg-gray-100 border-b border-gray-200">
            <span className="text-[11px] font-bold text-gray-600 uppercase tracking-widest">
              识别结果
            </span>
            {loading && (
              <span className="text-xs flex items-center gap-1" style={{ color: THEME_COLOR }}>
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
                    className="w-full h-full resize-none bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm font-mono text-gray-800"
                    placeholder="编辑识别结果..."
                  />
                ) : (
                  <div className="space-y-2">
                    {ocrBlocks.length > 0 && (
                      <div className="mb-3 p-2 bg-gray-100 rounded text-xs max-h-48 overflow-auto">
                        <div className="text-text-tertiary mb-2 sticky top-0 bg-gray-100">
                          识别详情（点击高亮对应区域）：
                        </div>
                        <div className="space-y-1">
                          {ocrBlocks.map((block, index) => {
                            const isSelected = selectedBlockIndex === index;
                            const confStyle = getConfidenceStyle(block.confidence);
                            return (
                              <div
                                key={index}
                                onClick={() => handleBlockClick(index)}
                                className="flex items-center gap-2 p-1.5 rounded cursor-pointer transition-colors"
                                style={isSelected
                                  ? { backgroundColor: '#dbeafe', border: '1px solid #3b82f6' }
                                  : { border: '1px solid transparent' }
                                }
                              >
                                <span
                                  className="w-5 h-5 flex items-center justify-center text-[10px] rounded text-white flex-shrink-0"
                                  style={{ backgroundColor: isSelected ? THEME_COLOR : '#22c55e' }}
                                >
                                  {index + 1}
                                </span>
                                <span className="text-text-secondary flex-1 truncate">
                                  {block.text.substring(0, 40)}
                                  {block.text.length > 40 ? '...' : ''}
                                </span>
                                <span
                                  className="text-xs px-1.5 py-0.5 rounded flex-shrink-0"
                                  style={{ backgroundColor: confStyle.bg, color: confStyle.text }}
                                >
                                  {(block.confidence * 100).toFixed(0)}%
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    <pre className="text-sm font-mono text-gray-800 whitespace-pre-wrap bg-gray-50 p-3 rounded-lg border border-gray-200 max-h-64 overflow-auto">
                      {ocrResult}
                    </pre>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                <div className="text-center">
                  <FileText className="w-16 h-16 opacity-50 mx-auto mb-4" />
                  <p>识别结果将显示在这里</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {history.length > 0 && (
        <div className="border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between px-4 py-2">
            <span className="text-xs font-bold text-gray-600 uppercase tracking-widest">
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
                className="flex-shrink-0 p-2 bg-gray-100 hover:bg-white border border-gray-200 rounded-lg transition-colors text-left"
                style={{ minWidth: 120 }}
              >
                <div className="text-xs text-gray-600 truncate">
                  {item.text.substring(0, 30)}
                  {item.text.length > 30 ? '...' : ''}
                </div>
                <div className="text-[10px] text-gray-500 mt-1">
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
          if (file) handleImageUpload(file);
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
    </div>
  );
};

export { ToolPanel };
