/**
 * QRCodeDisplay - QR code viewer supporting both raw data and pre-encoded base64 images
 *
 * Handles two types of QR data:
 * 1. Base64 PNG images (from WhatsApp backend) - displayed directly as <img>
 * 2. Raw data strings (from Android) - encoded using qrcode.react
 */

import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Spin, Result, Alert } from 'antd';
import { CheckCircleOutlined, LoadingOutlined, QrcodeOutlined, WarningOutlined } from '@ant-design/icons';

interface QRCodeDisplayProps {
  value?: string | null;
  isConnected?: boolean;
  size?: number;
  loading?: boolean;
  connectedTitle?: string;
  connectedSubtitle?: string;
  emptyText?: string;
}

/**
 * Check if the value is a base64-encoded image (PNG/JPEG)
 * Base64 images are typically very long strings without special QR characters
 */
const isBase64Image = (value: string): boolean => {
  // Base64 images are typically > 100 chars and contain only base64 characters
  if (value.length < 100) return false;

  // Check if it starts with data URI prefix
  if (value.startsWith('data:image/')) return true;

  // Check if it looks like raw base64 (no data: prefix but valid base64 chars)
  // Base64 PNG typically starts with 'iVBOR' and base64 JPEG with '/9j/'
  if (value.startsWith('iVBOR') || value.startsWith('/9j/')) return true;

  // General check: if it's very long and contains only base64 chars, it's likely an image
  // QR code raw data is typically short (< 4000 chars) and may contain special chars
  if (value.length > 5000) {
    const base64Regex = /^[A-Za-z0-9+/=]+$/;
    return base64Regex.test(value);
  }

  return false;
};

const QRCodeDisplay: React.FC<QRCodeDisplayProps> = ({
  value,
  isConnected = false,
  size = 160,
  loading = false,
  connectedTitle = 'Connected',
  connectedSubtitle = 'No QR code needed',
  emptyText = 'QR code not available',
}) => {
  if (isConnected) {
    return (
      <Result
        icon={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
        title={connectedTitle}
        subTitle={connectedSubtitle}
      />
    );
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 40 }}>
        <Spin indicator={<LoadingOutlined style={{ fontSize: 32 }} />} />
        <div style={{ marginTop: 16, color: '#888' }}>Waiting for QR code...</div>
      </div>
    );
  }

  if (!value) {
    return (
      <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>
        <QrcodeOutlined style={{ fontSize: 48, opacity: 0.3 }} />
        <div style={{ marginTop: 16 }}>{emptyText}</div>
      </div>
    );
  }

  // If value is already a base64 image, display it directly
  if (isBase64Image(value)) {
    const imgSrc = value.startsWith('data:') ? value : `data:image/png;base64,${value}`;
    return (
      <div style={{ textAlign: 'center', padding: 16 }}>
        <img
          src={imgSrc}
          alt="QR Code"
          style={{
            width: size,
            height: size,
            imageRendering: 'pixelated'
          }}
        />
      </div>
    );
  }

  // Otherwise, use qrcode.react to generate the QR code
  return <QRCodeRenderer value={value} size={size} />;
};

/**
 * Inner component that handles QR code rendering with error catching
 */
const QRCodeRenderer: React.FC<{ value: string; size: number }> = ({ value, size }) => {
  const [error, setError] = useState<string | null>(null);

  // Reset error state when value changes
  useEffect(() => {
    setError(null);
  }, [value]);

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: 24 }}>
        <Alert
          message="QR Code Error"
          description="The QR code data is too large to display. Please try refreshing or reconnecting."
          type="warning"
          icon={<WarningOutlined />}
          showIcon
        />
      </div>
    );
  }

  // Wrap in error boundary using componentDidCatch equivalent
  return (
    <QRCodeErrorBoundary onError={(err) => setError(err)}>
      <div style={{ textAlign: 'center', padding: 16 }}>
        <QRCodeSVG value={value} size={size} level="L" />
      </div>
    </QRCodeErrorBoundary>
  );
};

/**
 * Error boundary for catching QR code rendering errors
 */
class QRCodeErrorBoundary extends React.Component<
  { children: React.ReactNode; onError: (error: string) => void },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; onError: (error: string) => void }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_error: Error) {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error('[QRCodeDisplay] QR code rendering error:', error.message);
    this.props.onError(error.message);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ textAlign: 'center', padding: 24 }}>
          <Alert
            message="QR Code Error"
            description="The QR code data is too large to display. Please try refreshing or reconnecting."
            type="warning"
            icon={<WarningOutlined />}
            showIcon
          />
        </div>
      );
    }
    return this.props.children;
  }
}

export default QRCodeDisplay;
