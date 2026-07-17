import React, { useEffect } from 'react';
import { X, Check } from 'lucide-react';

const PRIMARY_COLOR = '#3b82f6';
const TEXT_PRIMARY = '#111827';
const TEXT_SECONDARY = '#6b7280';
const TEXT_TERTIARY = '#9ca3af';
const ERROR_COLOR = '#dc2626';
const SUCCESS_COLOR = '#059669';
const WARNING_COLOR = '#f59e0b';

export interface ToastItem {
  id: number;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
}

export const ToastContainer: React.FC<{ 
  toasts: ToastItem[]; 
  removeToast: (id: number) => void; 
  addToast: (toast: Omit<ToastItem, 'id'>) => void;
}> = ({ toasts, removeToast }) => {
  useEffect(() => {
    toasts.forEach((toast) => {
      const timer = setTimeout(() => {
        removeToast(toast.id);
      }, 3000);
      return () => clearTimeout(timer);
    });
  }, [toasts, removeToast]);

  const getToastStyle = (type: ToastItem['type']) => {
    switch (type) {
      case 'success': return 'bg-green-500 text-white';
      case 'error': return 'bg-red-500 text-white';
      case 'warning': return 'bg-amber-500 text-white';
      case 'info': return 'bg-blue-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`px-4 py-2 rounded-lg shadow-lg text-sm font-medium transition-all duration-300 transform ${getToastStyle(toast.type)}`}
          style={{ animation: 'slideIn 0.3s ease-out' }}
        >
          {toast.message}
        </div>
      ))}
      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(100%); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
};

export const Modal: React.FC<{ 
  title: string; 
  isOpen: boolean; 
  onClose: () => void; 
  onConfirm?: () => void; 
  children: React.ReactNode;
  showCancel?: boolean;
  showConfirm?: boolean;
  confirmText?: string;
  cancelText?: string;
}> = ({ 
  title, 
  isOpen, 
  onClose, 
  onConfirm, 
  children,
  showCancel = true,
  showConfirm = true,
  confirmText = '确认',
  cancelText = '取消'
}) => {
  if (!isOpen) return null;

  const handleClose = () => {
    onClose();
  };

  const handleConfirm = () => {
    onConfirm?.();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">{title}</h3>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="flex-1 overflow-auto p-4">{children}</div>
        {(showCancel || showConfirm) && (
          <div className="flex justify-end gap-2 px-4 py-3 border-t border-gray-200 dark:border-gray-700">
            {showCancel && (
              <button
                onClick={handleClose}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                {cancelText}
              </button>
            )}
            {showConfirm && (
              <button
                onClick={handleConfirm}
                className="px-4 py-2 text-sm text-white rounded-lg transition-colors"
                style={{ backgroundColor: PRIMARY_COLOR }}
              >
                {confirmText}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export const LoadingSpinner: React.FC<{ size?: 'sm' | 'md' | 'lg' }> = ({ size = 'md' }) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  return (
    <div className={`animate-spin ${sizeClasses[size]}`}>
      <svg className="w-full h-full text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
    </div>
  );
};

export const ToggleSwitch: React.FC<{ enabled: boolean; onChange: (val: boolean) => void }> = ({ enabled, onChange }) => {
  return (
    <button
      onClick={() => onChange(!enabled)}
      className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${
        enabled ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'
      }`}
    >
      <span
        className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${
          enabled ? 'translate-x-7' : 'translate-x-1'
        }`}
      />
    </button>
  );
};

export const SettingCard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      {children}
    </div>
  );
};