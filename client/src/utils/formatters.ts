// Common utility functions for formatting and clipboard operations

/**
 * Copy text to clipboard with error handling
 */
export const copyToClipboard = async (data: any, successMessage?: string): Promise<boolean> => {
  try {
    const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    await navigator.clipboard.writeText(text);
    if (successMessage) {
      // Import message from antd dynamically to avoid circular dependencies
      const { message } = await import('antd');
      message.success(successMessage);
    }
    return true;
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
};

/**
 * Format object as JSON string
 */
export const formatJson = (obj: any, compact: boolean = false): string => {
  return JSON.stringify(obj, null, compact ? 0 : 2);
};

/**
 * Format timestamp to locale string
 */
export const formatTimestamp = (timestamp: string | number | Date): string => {
  return new Date(timestamp).toLocaleString();
};