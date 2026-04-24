import { useState, useEffect, useCallback, useRef } from 'react';
import { useWebSocket } from '../contexts/WebSocketContext';

interface NodeAllowlistResponse {
  show_all: boolean;
  enabled_nodes: string[];
}

/**
 * Fetches the node allowlist from the backend and exposes a membership check
 * for the Component Palette.
 *
 * The backend decides whether to filter (show_all flag); the frontend only
 * checks list membership. While the response is loading, all nodes are shown
 * to avoid a palette flash.
 */
export const useNodeAllowlist = () => {
  const { sendRequest, isConnected } = useWebSocket();
  const [config, setConfig] = useState<NodeAllowlistResponse | null>(null);
  const hasFetchedRef = useRef(false);

  useEffect(() => {
    if (!isConnected || hasFetchedRef.current) return;
    hasFetchedRef.current = true;

    sendRequest<NodeAllowlistResponse>('get_node_allowlist', {})
      .then((response) => {
        setConfig({
          show_all: response?.show_all ?? true,
          enabled_nodes: response?.enabled_nodes ?? [],
        });
      })
      .catch((error) => {
        console.error('[NodeAllowlist] Failed to fetch:', error);
        setConfig({ show_all: true, enabled_nodes: [] });
      });
  }, [isConnected, sendRequest]);

  const isVisible = useCallback(
    (nodeType: string): boolean => {
      if (!config) return true;
      if (config.show_all) return true;
      return config.enabled_nodes.includes(nodeType);
    },
    [config]
  );

  return { isVisible };
};
