/**
 * RateLimitSection — WhatsApp rate limit configuration.
 * antd Form bound to RateLimitConfig from WebSocket.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Form, InputNumber, Switch } from 'antd';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';
import { useAppTheme } from '../../../hooks/useAppTheme';
import { useWebSocket, type RateLimitConfig, type RateLimitStats } from '../../../contexts/WebSocketContext';

const Stat: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="flex flex-col">
    <span className="text-xs text-muted-foreground">{label}</span>
    <span className="text-lg font-semibold">{value}</span>
  </div>
);

const RateLimitSection: React.FC = () => {
  const theme = useAppTheme();
  const { getWhatsAppRateLimitConfig, setWhatsAppRateLimitConfig, unpauseWhatsAppRateLimit } = useWebSocket();
  const [form] = Form.useForm<RateLimitConfig>();
  const [stats, setStats] = useState<RateLimitStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getWhatsAppRateLimitConfig();
      if (result.success && result.config) {
        form.setFieldsValue(result.config);
        setStats(result.stats ?? null);
        setDirty(false);
        setLoaded(true);
      }
    } finally {
      setLoading(false);
    }
  }, [form, getWhatsAppRateLimitConfig]);

  useEffect(() => { load(); }, [load]);

  const handleSave = useCallback(async () => {
    setLoading(true);
    try {
      const result = await setWhatsAppRateLimitConfig(form.getFieldsValue());
      if (result.success && result.config) {
        form.setFieldsValue(result.config);
        setDirty(false);
      }
    } finally {
      setLoading(false);
    }
  }, [form, setWhatsAppRateLimitConfig]);

  const handleUnpause = useCallback(async () => {
    setLoading(true);
    try {
      const result = await unpauseWhatsAppRateLimit();
      if (result.success && result.stats) setStats(result.stats);
    } finally {
      setLoading(false);
    }
  }, [unpauseWhatsAppRateLimit]);

  return (
    <Accordion type="single" collapsible>
      <AccordionItem value="ratelimits">
        <AccordionTrigger>
          <div className="flex w-full items-center justify-between gap-2">
            <span>Rate Limits</span>
            <span onClick={(e) => e.stopPropagation()}>
              <Form form={form} component={false}>
                <Form.Item name="enabled" valuePropName="checked" noStyle>
                  <Switch size="small" onChange={() => setDirty(true)} />
                </Form.Item>
              </Form>
            </span>
          </div>
        </AccordionTrigger>
        <AccordionContent>
          {!loaded ? (
        <div className="flex justify-center p-4 text-sm text-muted-foreground">Loading...</div>
      ) : (
        <Form form={form} layout="vertical" size="small" onValuesChange={() => setDirty(true)}>
          {stats && (
            <div className="mb-3 flex flex-wrap gap-4">
              <Stat label="Last Minute" value={stats.messages_sent_last_minute} />
              <Stat label="Last Hour" value={stats.messages_sent_last_hour} />
              <Stat label="Today" value={stats.messages_sent_today} />
              <Stat label="New Contacts" value={stats.new_contacts_today} />
              <Stat label="Responses" value={stats.responses_received} />
              <Stat
                label="Response Rate"
                value={`${Math.round((stats.response_rate || 0) * 100)}%`}
              />
            </div>
          )}
          {stats?.is_paused && (
            <Alert variant="warning" className="mb-3">
              <AlertDescription className="flex items-center justify-between gap-3">
                <span>{stats.pause_reason || 'Paused'}</span>
                <Button size="sm" variant="outline" onClick={handleUnpause}>Unpause</Button>
              </AlertDescription>
            </Alert>
          )}

          <div className="mb-1 text-xs font-medium text-muted-foreground">
            Message Delays (milliseconds)
          </div>
          <div className="flex flex-wrap gap-2">
            <Form.Item label="Min Delay" name="min_delay_ms"><InputNumber style={{ width: 120 }} /></Form.Item>
            <Form.Item label="Max Delay" name="max_delay_ms"><InputNumber style={{ width: 120 }} /></Form.Item>
            <Form.Item label="Typing Duration" name="typing_delay_ms"><InputNumber style={{ width: 120 }} /></Form.Item>
            <Form.Item label="Link Extra Delay" name="link_extra_delay_ms"><InputNumber style={{ width: 120 }} /></Form.Item>
          </div>

          <div className="mb-1 text-xs font-medium text-muted-foreground">Message Limits</div>
          <div className="flex flex-wrap gap-2">
            <Form.Item label="Per Minute" name="max_messages_per_minute"><InputNumber style={{ width: 120 }} /></Form.Item>
            <Form.Item label="Per Hour" name="max_messages_per_hour"><InputNumber style={{ width: 120 }} /></Form.Item>
            <Form.Item label="New Contacts/Day" name="max_new_contacts_per_day"><InputNumber style={{ width: 140 }} /></Form.Item>
          </div>

          <div className="mb-1 text-xs font-medium text-muted-foreground">Behavior</div>
          <div className="mb-3 flex w-full flex-col gap-2">
            <Form.Item label="Simulate Typing" name="simulate_typing" valuePropName="checked"
              extra="Show typing indicator before sending" style={{ marginBottom: 0 }}>
              <Switch />
            </Form.Item>
            <Form.Item label="Randomize Delays" name="randomize_delays" valuePropName="checked"
              extra="Add variance between min/max delay" style={{ marginBottom: 0 }}>
              <Switch />
            </Form.Item>
            <Form.Item label="Pause on Low Response" name="pause_on_low_response" valuePropName="checked"
              extra="Auto-pause if response rate drops below threshold" style={{ marginBottom: 0 }}>
              <Switch />
            </Form.Item>
            <Form.Item shouldUpdate={(p, c) => p.pause_on_low_response !== c.pause_on_low_response} noStyle>
              {({ getFieldValue }) => getFieldValue('pause_on_low_response') && (
                <Form.Item label="Response Rate Threshold (%)" name="response_rate_threshold"
                  normalize={(v: number) => v / 100}
                  getValueProps={(v: number) => ({ value: Math.round((v ?? 0.3) * 100) })}>
                  <InputNumber min={0} max={100} style={{ width: '100%' }} />
                </Form.Item>
              )}
            </Form.Item>
          </div>

          <Button
            onClick={handleSave}
            disabled={!dirty || loading}
            variant="outline"
            className="w-full"
            style={
              dirty
                ? {
                    backgroundColor: `${theme.dracula.green}25`,
                    borderColor: `${theme.dracula.green}60`,
                    color: theme.dracula.green,
                  }
                : undefined
            }
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </Form>
          )}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
};

export default RateLimitSection;
