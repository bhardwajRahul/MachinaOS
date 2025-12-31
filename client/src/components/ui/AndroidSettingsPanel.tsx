import React, { useState, useEffect } from 'react';
import { useAndroidStatus, useWebSocket } from '../../contexts/WebSocketContext';
import { useAppTheme } from '../../hooks/useAppTheme';
import { useApiKeys } from '../../hooks/useApiKeys';

interface AndroidSettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const AndroidSettingsPanel: React.FC<AndroidSettingsPanelProps> = ({ isOpen, onClose }) => {
  const theme = useAppTheme();
  const androidStatus = useAndroidStatus();
  const { sendRequest } = useWebSocket();
  const { getStoredApiKey, hasStoredKey } = useApiKeys();

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<'connect' | 'disconnect' | 'reconnect' | null>(null);
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);

  // Derive status from WebSocket state
  const isConnected = androidStatus.connected;
  const isPaired = androidStatus.paired;
  const qrData = androidStatus.qr_data;

  // Check if API key is configured when panel opens
  useEffect(() => {
    if (isOpen) {
      hasStoredKey('android_remote').then(setHasApiKey);
      setErrorMessage(null);
    }
  }, [isOpen, hasStoredKey]);

  const handleConnect = async () => {
    setActionLoading('connect');
    setErrorMessage(null);

    try {
      // Get stored API key
      const apiKey = await getStoredApiKey('android_remote');

      if (!apiKey) {
        setErrorMessage('No API key configured. Go to Credentials (key icon) to add your Android Remote API key.');
        setActionLoading(null);
        return;
      }

      // Send connect request via WebSocket with stored API key
      const response = await sendRequest('android_relay_connect', {
        url: import.meta.env.VITE_ANDROID_RELAY_URL || '',
        api_key: apiKey
      });
      if (!response.success) {
        setErrorMessage(response.error || 'Failed to connect');
      }
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to connect to relay');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDisconnect = async () => {
    setActionLoading('disconnect');
    setErrorMessage(null);
    try {
      // Send disconnect request via WebSocket
      const response = await sendRequest('android_relay_disconnect', {});
      if (!response.success) {
        setErrorMessage(response.error || 'Failed to disconnect');
      }
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to disconnect');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReconnect = async () => {
    setActionLoading('reconnect');
    setErrorMessage(null);

    try {
      // Get stored API key
      const apiKey = await getStoredApiKey('android_remote');

      if (!apiKey) {
        setErrorMessage('No API key configured. Go to Credentials (key icon) to add your Android Remote API key.');
        setActionLoading(null);
        return;
      }

      // Send reconnect request via WebSocket - forces new session token
      const response = await sendRequest('android_relay_reconnect', {
        url: import.meta.env.VITE_ANDROID_RELAY_URL || '',
        api_key: apiKey
      });
      if (!response.success) {
        setErrorMessage(response.error || 'Failed to reconnect');
      }
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to reconnect to relay');
    } finally {
      setActionLoading(null);
    }
  };

  if (!isOpen) return null;

  const needsApiKey = hasApiKey === false && !isConnected;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: theme.colors.background,
          borderRadius: '12px',
          padding: '24px',
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.4)',
          minWidth: '400px',
          maxWidth: '500px',
          border: `1px solid ${theme.colors.border}`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            marginBottom: '20px',
            paddingBottom: '16px',
            borderBottom: `2px solid ${theme.colors.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '24px' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="#3DDC84">
                <path d="M17.523 2.24a.75.75 0 0 0-1.046 1.046l1.5 1.5a.75.75 0 1 0 1.046-1.046l-1.5-1.5zM6.477 2.24a.75.75 0 0 1 1.046 1.046l-1.5 1.5a.75.75 0 0 1-1.046-1.046l1.5-1.5zM6.75 6h10.5a2.25 2.25 0 0 1 2.25 2.25v9a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 17.25v-9A2.25 2.25 0 0 1 6.75 6zm0 1.5a.75.75 0 0 0-.75.75v9c0 .414.336.75.75.75h10.5a.75.75 0 0 0 .75-.75v-9a.75.75 0 0 0-.75-.75H6.75zM12 20.25a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0V21a.75.75 0 0 1 .75-.75zM9 10.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm8 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"/>
              </svg>
            </span>
            <span style={{ fontWeight: '600', color: theme.colors.text, fontSize: '18px' }}>
              Android Relay Settings
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '20px',
              cursor: 'pointer',
              color: theme.colors.textSecondary,
              padding: '4px 8px',
            }}
          >
            x
          </button>
        </div>

        {/* API Key Warning */}
        {needsApiKey && (
          <div style={{
            background: '#fef3c7',
            border: '1px solid #fcd34d',
            padding: '12px',
            borderRadius: '8px',
            fontSize: '12px',
            color: '#92400e',
            lineHeight: '1.5',
            marginBottom: '16px'
          }}>
            <div style={{ fontWeight: '600', marginBottom: '4px' }}>API Key Required</div>
            <div>
              No Android Remote API key configured. Click the <strong>key icon</strong> in the toolbar to open Credentials and add your API key.
            </div>
          </div>
        )}

        {/* Connection Details */}
        <div style={{
          background: theme.colors.backgroundAlt,
          padding: '16px',
          borderRadius: '8px',
          fontSize: '13px',
          marginBottom: '16px'
        }}>
          <div style={{ fontWeight: '600', marginBottom: '12px', color: theme.colors.text, fontSize: '14px' }}>
            Connection Status
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: theme.colors.textSecondary }}>API Key:</span>
              <span style={{ color: hasApiKey ? '#3DDC84' : '#ef4444', fontWeight: '500' }}>
                {hasApiKey === null ? 'Checking...' : hasApiKey ? 'Configured' : 'Not configured'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: theme.colors.textSecondary }}>Relay:</span>
              <span style={{ color: isConnected ? '#3DDC84' : '#ef4444', fontWeight: '500' }}>
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: theme.colors.textSecondary }}>Device:</span>
              <span style={{ color: isPaired ? '#3DDC84' : '#f59e0b', fontWeight: '500' }}>
                {isPaired ? 'Paired' : 'Waiting for pairing'}
              </span>
            </div>
            {androidStatus.device_id && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: theme.colors.textSecondary }}>Device ID:</span>
                <span style={{ color: theme.colors.text, fontWeight: '500', fontSize: '11px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {androidStatus.device_id}
                </span>
              </div>
            )}
            {androidStatus.device_name && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: theme.colors.textSecondary }}>Device Name:</span>
                <span style={{ color: theme.colors.text, fontWeight: '500' }}>
                  {androidStatus.device_name}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* QR Code Section */}
        <div style={{
          background: theme.colors.backgroundAlt,
          padding: '16px',
          borderRadius: '8px',
          marginBottom: '16px'
        }}>
          <div style={{ fontWeight: '600', marginBottom: '12px', color: theme.colors.text, fontSize: '14px', textAlign: 'center' }}>
            QR Code Pairing
          </div>
          <div style={{
            background: theme.colors.background,
            padding: '20px',
            borderRadius: '8px',
            textAlign: 'center',
            minHeight: '220px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            gap: '12px'
          }}>
            {isPaired ? (
              <div style={{ color: '#3DDC84', fontSize: '14px' }}>
                <div style={{ fontSize: '56px', marginBottom: '12px' }}>OK</div>
                <div style={{ fontWeight: '600' }}>Device Paired!</div>
                <div style={{ color: theme.colors.textSecondary, fontSize: '12px', marginTop: '4px' }}>
                  {androidStatus.device_name || androidStatus.device_id || 'Android Device'}
                </div>
              </div>
            ) : qrData ? (
              <div style={{ width: '100%' }}>
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrData)}`}
                  alt="Android Pairing QR Code"
                  style={{ maxWidth: '200px', margin: '0 auto', display: 'block', borderRadius: '8px' }}
                />
                <div style={{ color: theme.colors.textSecondary, fontSize: '12px', marginTop: '12px' }}>
                  Scan with Android companion app to pair
                </div>
              </div>
            ) : isConnected ? (
              <div style={{ color: theme.colors.textSecondary, fontSize: '14px' }}>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>...</div>
                <div>Waiting for QR code...</div>
                <div style={{ fontSize: '12px', marginTop: '8px' }}>
                  QR code will appear when relay server sends it
                </div>
              </div>
            ) : (
              <div style={{ color: theme.colors.textSecondary, fontSize: '14px' }}>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>[]</div>
                <div>Not connected to relay</div>
                <div style={{ fontSize: '12px', marginTop: '8px' }}>
                  {hasApiKey ? 'Click Connect to start' : 'Add API key in Credentials first'}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Error Message */}
        {errorMessage && (
          <div style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            padding: '12px',
            borderRadius: '8px',
            fontSize: '12px',
            color: '#991b1b',
            lineHeight: '1.5',
            marginBottom: '16px'
          }}>
            <div style={{ fontWeight: '600', marginBottom: '4px' }}>Error:</div>
            <div>{errorMessage}</div>
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={handleConnect}
            disabled={actionLoading !== null || isConnected || !hasApiKey}
            style={{
              flex: 1,
              minWidth: '100px',
              padding: '12px 16px',
              background: actionLoading === 'connect' ? '#9ca3af' : (isConnected || !hasApiKey) ? '#6b7280' : '#3DDC84',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: actionLoading !== null || isConnected || !hasApiKey ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              transition: 'background 0.2s ease',
            }}
          >
            {actionLoading === 'connect' ? 'Connecting...' : 'Connect'}
          </button>

          <button
            onClick={handleReconnect}
            disabled={actionLoading !== null || !isConnected || !hasApiKey}
            style={{
              flex: 1,
              minWidth: '100px',
              padding: '12px 16px',
              background: actionLoading === 'reconnect' ? '#9ca3af' : (!isConnected || !hasApiKey) ? '#6b7280' : '#f59e0b',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: actionLoading !== null || !isConnected || !hasApiKey ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              transition: 'background 0.2s ease',
            }}
          >
            {actionLoading === 'reconnect' ? 'Reconnecting...' : 'Reconnect'}
          </button>

          <button
            onClick={handleDisconnect}
            disabled={actionLoading !== null || !isConnected}
            style={{
              flex: 1,
              minWidth: '100px',
              padding: '12px 16px',
              background: actionLoading === 'disconnect' ? '#9ca3af' : !isConnected ? '#6b7280' : '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: actionLoading !== null || !isConnected ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              transition: 'background 0.2s ease',
            }}
          >
            {actionLoading === 'disconnect' ? 'Disconnecting...' : 'Disconnect'}
          </button>
        </div>

        {/* Reconnect Help Text */}
        {isConnected && (
          <div style={{
            marginTop: '12px',
            fontSize: '11px',
            color: theme.colors.textMuted,
            textAlign: 'center'
          }}>
            Use Reconnect to get a new QR code if pairing fails or device needs to re-pair
          </div>
        )}
      </div>
    </div>
  );
};

export default AndroidSettingsPanel;
