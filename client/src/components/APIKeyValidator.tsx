import React, { useEffect } from 'react';
import { Input, Button, Space, Tag, Tooltip } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, LoadingOutlined, DeleteOutlined } from '@ant-design/icons';
import { useApiKeyValidation } from '../hooks/useApiKeyValidation';

interface APIKeyValidatorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  validationConfig: {
    provider?: string;
    showValidateButton?: boolean;
  };
  onValidationSuccess?: (models: string[]) => void;
  isDragOver?: boolean;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
}

const APIKeyValidator: React.FC<APIKeyValidatorProps> = ({
  value,
  onChange,
  placeholder,
  validationConfig,
  onValidationSuccess,
  isDragOver = false,
  onDragOver,
  onDragLeave,
  onDrop
}) => {
  const { status, hasStoredKey, validate, clear, getStoredKey, isValidating, isValid } = useApiKeyValidation({
    provider: validationConfig.provider,
    onSuccess: onValidationSuccess
  });

  // Auto-load stored key on mount
  useEffect(() => {
    if (hasStoredKey && !value) {
      getStoredKey().then(storedKey => {
        if (storedKey) onChange(storedKey);
      });
    }
  }, [hasStoredKey, value, onChange, getStoredKey]);

  const handleValidate = () => validate(value);

  const handleClear = async () => {
    await clear();
    onChange('');
  };

  const getStatusIcon = () => {
    if (isValidating) return <LoadingOutlined />;
    if (isValid) return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
    if (status === 'invalid') return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />;
    return null;
  };

  const getStatusTag = () => {
    if (hasStoredKey && isValid) {
      return (
        <Tag color="success" icon={<CheckCircleOutlined />}>
          Validated
        </Tag>
      );
    }
    return null;
  };

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="small">
      <Space.Compact style={{ width: '100%' }}>
        <Input.Password
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder || 'Enter API key...'}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          suffix={getStatusIcon()}
          status={status === 'invalid' ? 'error' : undefined}
          style={{
            fontFamily: 'monospace',
            borderColor: isDragOver ? '#1890ff' : undefined,
            backgroundColor: isDragOver ? '#e6f7ff' : undefined
          }}
        />

        {validationConfig.showValidateButton && (
          <Button
            type={isValid ? 'primary' : 'default'}
            loading={isValidating}
            disabled={!value?.trim() || isValidating}
            onClick={handleValidate}
          >
            {isValidating ? 'Validating' : isValid ? 'Valid' : 'Validate'}
          </Button>
        )}

        {hasStoredKey && (
          <Tooltip title="Clear stored API key">
            <Button
              icon={<DeleteOutlined />}
              onClick={handleClear}
              type="text"
              size="small"
            />
          </Tooltip>
        )}
      </Space.Compact>

      {getStatusTag()}
    </Space>
  );
};

export default APIKeyValidator;