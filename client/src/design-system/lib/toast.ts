/**
 * Thin adapter over sonner so call sites read like the antd API they replace.
 *
 * antd:  message.success('Saved', 2)
 *        notification.error({ message, description })
 * here:  toast.success('Saved')
 *        toast.error(message, { description })
 */

import { toast as sonnerToast, type ExternalToast } from 'sonner';

export const toast = {
  success: (message: string, options?: ExternalToast) => sonnerToast.success(message, options),
  error: (message: string, options?: ExternalToast) => sonnerToast.error(message, options),
  warning: (message: string, options?: ExternalToast) => sonnerToast.warning(message, options),
  info: (message: string, options?: ExternalToast) => sonnerToast.info(message, options),
  loading: (message: string, options?: ExternalToast) => sonnerToast.loading(message, options),
  promise: sonnerToast.promise,
  dismiss: sonnerToast.dismiss,
  message: sonnerToast,
};

export type Toast = typeof toast;
