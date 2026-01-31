/**
 * ApiKeyInput - Reusable API key input component with central theming
 */

import React, { useState } from 'react';
import { Input, Button, Space } from 'antd';
import { SaveOutlined, DeleteOutlined, EyeOutlined, EyeInvisibleOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useAppTheme } from '../../hooks/useAppTheme';

interface ApiKeyInputProps {
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  onDelete?: () => void;
  placeholder?: string;
  loading?: boolean;
  isStored?: boolean | null;
  disabled?: boolean;
  /** Label for save button (default: 'Validate') */
  saveLabel?: string;
  /** Label when validated/saved (default: 'Valid') */
  savedLabel?: string;
}

const ApiKeyInput: React.FC<ApiKeyInputProps> = ({
  value,
  onChange,
  onSave,
  onDelete,
  placeholder = 'Enter API key...',
  loading = false,
  isStored = false,
  disabled = false,
  saveLabel = 'Validate',
  savedLabel = 'Valid',
}) => {
  const theme = useAppTheme();
  const [visible, setVisible] = useState(false);

  return (
    <Space.Compact style={{ width: '100%' }}>
      <Input
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        style={{
          fontFamily: 'monospace',
          backgroundColor: theme.colors.background,
          borderColor: theme.colors.border,
          color: theme.colors.text,
        }}
        suffix={
          <Button
            type="text"
            size="small"
            icon={visible ? <EyeInvisibleOutlined /> : <EyeOutlined />}
            onClick={() => setVisible(!visible)}
            style={{ color: theme.colors.textSecondary }}
          />
        }
      />
      <Button
        icon={isStored ? <CheckCircleOutlined /> : <SaveOutlined />}
        loading={loading}
        onClick={onSave}
        disabled={!value.trim() || disabled}
        style={{
          backgroundColor: `${theme.dracula.green}25`,
          borderColor: `${theme.dracula.green}60`,
          color: theme.dracula.green,
        }}
      >
        {isStored ? savedLabel : saveLabel}
      </Button>
      {isStored && onDelete && (
        <Button
          icon={<DeleteOutlined />}
          onClick={onDelete}
          disabled={disabled}
          style={{
            backgroundColor: `${theme.dracula.pink}25`,
            borderColor: `${theme.dracula.pink}60`,
            color: theme.dracula.pink,
          }}
        />
      )}
    </Space.Compact>
  );
};

export default ApiKeyInput;
