/**
 * FieldRenderer — generic schema-driven field renderer (n8n CredentialInputs pattern).
 * Takes a FieldDef[] array + antd Form instance, renders the right control per field.
 * Replaces all manual Input/Input.Password/label blocks across panels.
 */

import React from 'react';
import { Form, Input, Space } from 'antd';
import { useAppTheme } from '../../../hooks/useAppTheme';
import type { FieldDef } from '../types';
import type { FormInstance } from 'antd';

interface Props {
  fields: FieldDef[];
  form: FormInstance;
}

const FieldRenderer: React.FC<Props> = ({ fields, form }) => {
  const theme = useAppTheme();
  const inputStyle: React.CSSProperties = {
    fontFamily: theme.fontFamily?.mono || 'monospace',
    fontSize: theme.fontSize.sm,
  };

  return (
    <Space direction="vertical" size="small" style={{ width: '100%' }}>
      {fields.map(f => (
        <Form.Item key={f.key} label={f.label} required={f.required}
          style={{ marginBottom: theme.spacing.xs }}>
          {f.secret ? (
            <Input.Password
              value={form.getFieldValue(f.key) || ''}
              onChange={e => form.setFieldValue(f.key, e.target.value)}
              placeholder={f.placeholder}
              style={inputStyle}
            />
          ) : (
            <Input
              value={form.getFieldValue(f.key) || ''}
              onChange={e => form.setFieldValue(f.key, e.target.value)}
              placeholder={f.placeholder}
              style={inputStyle}
            />
          )}
        </Form.Item>
      ))}
    </Space>
  );
};

export default FieldRenderer;
