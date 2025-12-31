import React, { useState, useEffect } from 'react';
import { useWhatsApp } from '../../hooks/useWhatsApp';
import { useWhatsAppStatus } from '../../contexts/WebSocketContext';
import { useAppTheme } from '../../hooks/useAppTheme';

interface WhatsAppSettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const WhatsAppSettingsPanel: React.FC<WhatsAppSettingsPanelProps> = ({ isOpen, onClose }) => {
  const theme = useAppTheme();
  const { getStatus, startConnection, restartConnection } = useWhatsApp();
  const whatsappStatus = useWhatsAppStatus();

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<'restart' | 'start' | 'refresh' | null>(null);

  // Derive status from reactive WebSocket state
  const status = whatsappStatus.connected ? 'connected' : 'disconnected';

  // QR data comes from WebSocket status when pairing
  const qrData = whatsappStatus.qr
    ? { qr: whatsappStatus.qr, connected: false }
    : whatsappStatus.connected
    ? { connected: true }
    : { connected: false, message: whatsappStatus.running ? 'Waiting for QR code...' : 'Service not running' };

  // Fetch initial status when panel opens
  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);
      getStatus().catch(err => console.error('[WhatsAppSettings] Initial status failed:', err));
    }
  }, [isOpen, getStatus]);

  const handleRefreshStatus = async () => {
    console.log('[WhatsAppSettings] Refresh status clicked');
    setActionLoading('refresh');
    setErrorMessage(null);
    try {
      await getStatus();
      console.log('[WhatsAppSettings] Refresh status complete');
    } catch (error: any) {
      console.error('[WhatsAppSettings] Refresh status failed:', error);
      setErrorMessage(error.message || 'Failed to refresh status');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRestart = async () => {
    setActionLoading('restart');
    setErrorMessage(null);

    try {
      const result = await restartConnection();
      if (!result.success && result.message) {
        setErrorMessage(result.message);
      }
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to restart service');
    } finally {
      setActionLoading(null);
    }
  };

  const handleStart = async () => {
    setActionLoading('start');
    setErrorMessage(null);

    try {
      const result = await startConnection();
      if (!result.success && result.message) {
        setErrorMessage(result.message);
      }
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to start service');
    } finally {
      setActionLoading(null);
    }
  };

  if (!isOpen) return null;

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
              <svg width="24" height="24" viewBox="0 0 24 24" fill="#25D366">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
            </span>
            <span style={{ fontWeight: '600', color: theme.colors.text, fontSize: '18px' }}>
              WhatsApp Settings
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
            {whatsappStatus.device_id && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: theme.colors.textSecondary }}>Device ID:</span>
                <span style={{ color: theme.colors.text, fontWeight: '500', fontSize: '11px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {whatsappStatus.device_id}
                </span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: theme.colors.textSecondary }}>Status:</span>
              <span style={{ color: status === 'connected' ? '#25D366' : '#ef4444', fontWeight: '500' }}>
                {status === 'connected' ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: theme.colors.textSecondary }}>Session:</span>
              <span style={{ color: whatsappStatus.has_session ? '#25D366' : '#ef4444', fontWeight: '500' }}>
                {whatsappStatus.has_session ? 'Active' : 'Inactive'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: theme.colors.textSecondary }}>Service:</span>
              <span style={{ color: whatsappStatus.running ? '#25D366' : '#ef4444', fontWeight: '500' }}>
                {whatsappStatus.running ? 'Running' : 'Stopped'}
              </span>
            </div>
            {whatsappStatus.pairing !== undefined && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: theme.colors.textSecondary }}>Pairing:</span>
                <span style={{ color: whatsappStatus.pairing ? '#f59e0b' : theme.colors.textSecondary, fontWeight: '500' }}>
                  {whatsappStatus.pairing ? 'In Progress' : 'Complete'}
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
            QR Code Authentication
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
            {qrData.connected ? (
              <div style={{ color: '#25D366', fontSize: '14px' }}>
                <div style={{ fontSize: '56px', marginBottom: '12px' }}>OK</div>
                <div style={{ fontWeight: '600' }}>Already Connected!</div>
                <div style={{ color: theme.colors.textSecondary, fontSize: '12px', marginTop: '4px' }}>No QR code needed</div>
              </div>
            ) : qrData.qr ? (
              <div style={{ width: '100%' }}>
                <img
                  src={`data:image/png;base64,${qrData.qr}`}
                  alt="WhatsApp QR Code"
                  style={{ maxWidth: '200px', margin: '0 auto', display: 'block' }}
                />
                <div style={{ color: theme.colors.textSecondary, fontSize: '12px', marginTop: '12px' }}>
                  Scan with WhatsApp mobile app
                </div>
              </div>
            ) : (
              <div style={{ color: theme.colors.textSecondary, fontSize: '14px' }}>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>[]</div>
                <div>{qrData.message || 'QR code not available'}</div>
                <a
                  href="http://localhost:5000"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: '#3b82f6',
                    textDecoration: 'underline',
                    fontSize: '12px',
                    marginTop: '8px',
                    display: 'block'
                  }}
                >
                  Open WhatsApp Dashboard
                </a>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={handleStart}
              disabled={actionLoading !== null}
              style={{
                flex: 1,
                padding: '12px 16px',
                background: actionLoading === 'start' ? '#9ca3af' : '#16a34a',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: actionLoading !== null ? 'wait' : 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                transition: 'background 0.2s ease',
              }}
            >
              {actionLoading === 'start' ? 'Starting...' : 'Start'}
            </button>

            <button
              onClick={handleRestart}
              disabled={actionLoading !== null}
              style={{
                flex: 1,
                padding: '12px 16px',
                background: actionLoading === 'restart' ? '#9ca3af' : '#f59e0b',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: actionLoading !== null ? 'wait' : 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                transition: 'background 0.2s ease',
              }}
            >
              {actionLoading === 'restart' ? 'Restarting...' : 'Restart'}
            </button>
          </div>

          <button
            onClick={handleRefreshStatus}
            disabled={actionLoading !== null}
            style={{
              width: '100%',
              padding: '12px 16px',
              background: actionLoading === 'refresh' ? '#60a5fa' : actionLoading !== null ? '#9ca3af' : '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: actionLoading !== null ? 'wait' : 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              transition: 'background 0.2s ease',
              pointerEvents: 'auto',
            }}
          >
            {actionLoading === 'refresh' ? 'Refreshing...' : 'Refresh Status'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default WhatsAppSettingsPanel;
