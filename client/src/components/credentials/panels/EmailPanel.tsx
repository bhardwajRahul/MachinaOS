/**
 * EmailPanel — Himalaya IMAP/SMTP credentials.
 *
 * antd Form with:
 *   - Select (provider preset) + per-provider AUTH_NOTES
 *   - Email/Password inputs with "leave blank to keep existing" hint
 *   - Conditional custom IMAP/SMTP block via Form.useWatch('provider')
 *
 * Credentials stored via saveApiKey/removeApiKey as individual keys.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Form, Select, Input, InputNumber, Button, Alert, Flex, Space } from 'antd';
import { useAppTheme } from '../../../hooks/useAppTheme';
import { useApiKeys } from '../../../hooks/useApiKeys';
import { StatusCard } from '../primitives';
import type { ProviderConfig } from '../types';

const PROVIDER_OPTIONS = [
  { label: 'Gmail', value: 'gmail' },
  { label: 'Outlook / Office 365', value: 'outlook' },
  { label: 'Yahoo Mail', value: 'yahoo' },
  { label: 'iCloud Mail', value: 'icloud' },
  { label: 'ProtonMail (Bridge)', value: 'protonmail' },
  { label: 'Fastmail', value: 'fastmail' },
  { label: 'Custom / Self-hosted', value: 'custom' },
];

const AUTH_NOTES: Record<string, string> = {
  gmail: 'Use an App Password from Google Account > Security > 2-Step Verification.',
  outlook: 'Use your account password or an App Password.',
  yahoo: 'Use an App Password from Yahoo Account Security.',
  icloud: 'Use an App-Specific Password from your Apple ID.',
  protonmail: 'Requires ProtonMail Bridge running locally (127.0.0.1).',
  fastmail: 'Use an App Password from Settings > Privacy & Security.',
  custom: 'Enter credentials for your self-hosted IMAP/SMTP server below.',
};

interface EmailForm {
  provider: string;
  address: string;
  password: string;
  imapHost: string;
  imapPort: number;
  smtpHost: string;
  smtpPort: number;
}

const EmailPanel: React.FC<{ config: ProviderConfig; visible: boolean }> = ({ config, visible }) => {
  const theme = useAppTheme();
  const { saveApiKey, getStoredApiKey, hasStoredKey, removeApiKey, isConnected } = useApiKeys();

  const [form] = Form.useForm<EmailForm>();
  const provider = Form.useWatch('provider', form) ?? 'gmail';
  const [stored, setStored] = useState(false);
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load credentials on mount
  useEffect(() => {
    if (!visible || !isConnected) return;
    let cancelled = false;
    (async () => {
      try {
        const [provider, addr, hasPassword, imapHost, imapPort, smtpHost, smtpPort] = await Promise.all([
          getStoredApiKey('email_provider'),
          getStoredApiKey('email_address'),
          hasStoredKey('email_password'),
          getStoredApiKey('email_imap_host'),
          getStoredApiKey('email_imap_port'),
          getStoredApiKey('email_smtp_host'),
          getStoredApiKey('email_smtp_port'),
        ]);
        if (cancelled) return;
        form.setFieldsValue({
          provider: provider || 'gmail',
          address: addr || '',
          password: '',
          imapHost: imapHost || '',
          imapPort: imapPort ? parseInt(imapPort, 10) : 993,
          smtpHost: smtpHost || '',
          smtpPort: smtpPort ? parseInt(smtpPort, 10) : 465,
        });
        setAddress(addr || '');
        setStored(hasPassword);
      } catch {
        if (!cancelled) setStored(false);
      }
    })();
    return () => { cancelled = true; };
  }, [visible, isConnected]);

  const handleSave = useCallback(async () => {
    const values = form.getFieldsValue();
    if (!values.address?.trim()) { setError('Email address is required'); return; }
    if (!values.password?.trim() && !stored) { setError('Password is required'); return; }
    if (values.provider === 'custom') {
      if (!values.imapHost?.trim() || !values.smtpHost?.trim()) {
        setError('IMAP and SMTP host are required for custom provider');
        return;
      }
    }
    setLoading('save');
    setError(null);
    try {
      await saveApiKey('email_provider', values.provider);
      await saveApiKey('email_address', values.address.trim());
      if (values.password?.trim()) await saveApiKey('email_password', values.password.trim());
      if (values.provider === 'custom') {
        await saveApiKey('email_imap_host', values.imapHost.trim());
        await saveApiKey('email_imap_port', String(values.imapPort));
        await saveApiKey('email_smtp_host', values.smtpHost.trim());
        await saveApiKey('email_smtp_port', String(values.smtpPort));
      }
      setStored(true);
      setAddress(values.address.trim());
      form.setFieldValue('password', '');
    } catch (err: any) {
      setError(err.message || 'Failed to save email credentials');
    } finally {
      setLoading(null);
    }
  }, [form, stored, saveApiKey]);

  const handleRemove = useCallback(async () => {
    setLoading('remove');
    setError(null);
    try {
      await Promise.all([
        removeApiKey('email_password'),
        removeApiKey('email_address'),
        removeApiKey('email_provider'),
        removeApiKey('email_imap_host'),
        removeApiKey('email_imap_port'),
        removeApiKey('email_smtp_host'),
        removeApiKey('email_smtp_port'),
      ]);
      setStored(false);
      setAddress('');
      form.resetFields();
    } catch (err: any) {
      setError(err.message || 'Failed to remove credentials');
    } finally {
      setLoading(null);
    }
  }, [form, removeApiKey]);

  const iconSize = parseInt(theme.iconSize.md);

  return (
    <Flex vertical gap={theme.spacing.lg} style={{ padding: theme.spacing.xl, flex: 1, minHeight: 0 }}>
      <StatusCard icon={<config.icon size={iconSize} />} title={config.name} status={{ stored, address }}
        rows={[
          { label: 'Status', ok: s => s.stored, trueText: 'Configured', falseText: 'Not configured' },
          ...(stored && address ? [{
            label: 'Account',
            ok: () => true,
            trueText: address,
            falseText: '',
          }] : []),
        ]} />

      <Form form={form} layout="vertical" size="middle" initialValues={{ provider: 'gmail', imapPort: 993, smtpPort: 465 }}>
        <Form.Item label="Provider" name="provider">
          <Select options={PROVIDER_OPTIONS} />
        </Form.Item>

        <Form.Item label="Email Address" name="address" rules={[{ required: true, message: 'Email address is required' }]}>
          <Input placeholder="you@example.com" />
        </Form.Item>

        <Form.Item
          label={<Space>Password {stored && <span style={{ color: theme.colors.textMuted, fontWeight: theme.fontWeight.normal, fontSize: theme.fontSize.xs }}>(leave blank to keep existing)</span>}</Space>}
          name="password"
          extra={AUTH_NOTES[provider]}
        >
          <Input.Password placeholder={stored ? '••••••••' : 'App password or account password'} style={{ fontFamily: 'monospace' }} />
        </Form.Item>

        <Form.Item shouldUpdate={(p, c) => p.provider !== c.provider} noStyle>
          {({ getFieldValue }) => getFieldValue('provider') === 'custom' && (
            <div style={{
              padding: theme.spacing.md,
              marginBottom: theme.spacing.lg,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: theme.borderRadius.md,
              backgroundColor: theme.colors.backgroundAlt,
            }}>
              <div style={{ fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.medium, color: theme.colors.text, marginBottom: theme.spacing.md }}>
                Custom IMAP / SMTP
              </div>
              <Flex gap={theme.spacing.md}>
                <Form.Item label="IMAP Host" name="imapHost" style={{ flex: 2 }}>
                  <Input placeholder="imap.example.com" />
                </Form.Item>
                <Form.Item label="IMAP Port" name="imapPort" style={{ flex: 1 }}>
                  <InputNumber min={1} max={65535} style={{ width: '100%' }} />
                </Form.Item>
              </Flex>
              <Flex gap={theme.spacing.md}>
                <Form.Item label="SMTP Host" name="smtpHost" style={{ flex: 2 }}>
                  <Input placeholder="smtp.example.com" />
                </Form.Item>
                <Form.Item label="SMTP Port" name="smtpPort" style={{ flex: 1 }}>
                  <InputNumber min={1} max={65535} style={{ width: '100%' }} />
                </Form.Item>
              </Flex>
            </div>
          )}
        </Form.Item>
      </Form>

      {error && <Alert type="error" message={error} showIcon />}

      <div style={{ flex: 1 }} />

      <Flex gap={theme.spacing.sm} justify="center" style={{ paddingTop: theme.spacing.md, borderTop: `1px solid ${theme.colors.border}` }}>
        <Button onClick={handleSave} loading={loading === 'save'}
          style={{ backgroundColor: `${theme.dracula.green}25`, borderColor: `${theme.dracula.green}60`, color: theme.dracula.green }}>
          Save
        </Button>
        {stored && (
          <Button onClick={handleRemove} loading={loading === 'remove'}
            style={{ backgroundColor: `${theme.dracula.pink}25`, borderColor: `${theme.dracula.pink}60`, color: theme.dracula.pink }}>
            Remove
          </Button>
        )}
      </Flex>
    </Flex>
  );
};

export default EmailPanel;
