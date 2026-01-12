/**
 * ToolSchemaEditor - Schema editor for Android Toolkit node
 *
 * Shows connected Android service nodes and schema fields for the LLM
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Node } from 'reactflow';
import { useAppTheme } from '../../hooks/useAppTheme';
import { useToolSchema, ToolSchemaConfig, SchemaFieldConfig } from '../../hooks/useToolSchema';
import { useWebSocket } from '../../contexts/WebSocketContext';
import { useAppStore } from '../../store/useAppStore';
import { ANDROID_SERVICE_NODE_TYPES } from '../../nodeDefinitions/androidServiceNodes';

interface ToolSchemaEditorProps {
  nodeId: string;
  toolName: string;
  toolDescription: string;
}

const FIELD_TYPES = ['string', 'number', 'integer', 'boolean', 'object', 'array'] as const;

// Default schema for androidTool
const DEFAULT_SCHEMA: ToolSchemaConfig = {
  description: 'Control Android device via connected services',
  fields: {
    service_id: {
      type: 'string',
      description: 'Service to use (determined by connected Android nodes)',
      required: true
    },
    action: {
      type: 'string',
      description: 'Action to perform (see service list for available actions)',
      required: true
    },
    parameters: {
      type: 'object',
      description: 'Action parameters. Examples: {package_name: "com.app"} for app_launcher',
      required: false
    }
  }
};

const ToolSchemaEditor: React.FC<ToolSchemaEditorProps> = ({ nodeId }) => {
  const theme = useAppTheme();
  const { getToolSchema, saveToolSchema, deleteToolSchema, isLoading } = useToolSchema();
  const { isConnected } = useWebSocket();
  const { currentWorkflow } = useAppStore();

  // Get the current node
  const currentNode = useMemo(() => {
    if (!currentWorkflow?.nodes) return null;
    return currentWorkflow.nodes.find(n => n.id === nodeId);
  }, [currentWorkflow?.nodes, nodeId]);

  const isAndroidTool = currentNode?.type === 'androidTool';

  // Only show for androidTool
  if (!isAndroidTool) return null;

  // Find connected Android service nodes via edges
  const connectedServices = useMemo(() => {
    if (!currentWorkflow?.edges || !currentWorkflow?.nodes) return [];

    // Find all edges targeting this androidTool node
    const incomingEdges = currentWorkflow.edges.filter(edge => edge.target === nodeId);

    const services: Node[] = [];
    for (const edge of incomingEdges) {
      const sourceNode = currentWorkflow.nodes.find(n => n.id === edge.source);
      if (sourceNode && ANDROID_SERVICE_NODE_TYPES.includes(sourceNode.type || '')) {
        services.push(sourceNode);
      }
    }
    return services;
  }, [currentWorkflow?.edges, currentWorkflow?.nodes, nodeId]);

  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [localSchema, setLocalSchema] = useState<ToolSchemaConfig>(DEFAULT_SCHEMA);
  const [hasChanges, setHasChanges] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Auto-select first connected service if none selected
  useEffect(() => {
    if (connectedServices.length > 0 && !selectedServiceId) {
      setSelectedServiceId(connectedServices[0].id);
    } else if (connectedServices.length === 0) {
      setSelectedServiceId(null);
    } else if (selectedServiceId && !connectedServices.find(s => s.id === selectedServiceId)) {
      // Selected service was disconnected, select first available
      setSelectedServiceId(connectedServices[0]?.id || null);
    }
  }, [connectedServices, selectedServiceId]);

  const selectedService = useMemo(() => {
    if (!selectedServiceId) return null;
    return connectedServices.find(s => s.id === selectedServiceId) || null;
  }, [connectedServices, selectedServiceId]);

  // Build default schema for selected service
  const getDefaultSchemaForService = useCallback((service: Node | null): ToolSchemaConfig => {
    if (!service) return DEFAULT_SCHEMA;

    const serviceType = service.type || 'unknown';
    const serviceName = service.data?.label || serviceType;

    // Create service-specific default schema
    return {
      description: `Control ${serviceName} on Android device`,
      fields: {
        action: {
          type: 'string',
          description: `Action to perform on ${serviceName}`,
          required: true
        },
        parameters: {
          type: 'object',
          description: `Parameters for the ${serviceName} action`,
          required: false
        }
      }
    };
  }, []);

  // Load existing schema for selected service
  useEffect(() => {
    const loadSchema = async () => {
      if (!isConnected || !selectedServiceId) {
        setLocalSchema(DEFAULT_SCHEMA);
        return;
      }

      // Use service node ID as the key for storing schema
      const schema = await getToolSchema(selectedServiceId);
      if (schema?.schema_config && Object.keys(schema.schema_config.fields || {}).length > 0) {
        setLocalSchema(schema.schema_config);
      } else {
        // Use service-specific default
        setLocalSchema(getDefaultSchemaForService(selectedService));
      }
      setHasChanges(false);
    };
    loadSchema();
  }, [selectedServiceId, selectedService, isConnected, getToolSchema, getDefaultSchemaForService]);

  const handleAddField = useCallback(() => {
    const newFieldName = `field_${Object.keys(localSchema.fields).length + 1}`;
    setLocalSchema(prev => ({
      ...prev,
      fields: {
        ...prev.fields,
        [newFieldName]: { type: 'string', description: '', required: false }
      }
    }));
    setHasChanges(true);
  }, [localSchema.fields]);

  const handleRemoveField = useCallback((fieldName: string) => {
    setLocalSchema(prev => {
      const { [fieldName]: _, ...rest } = prev.fields;
      return { ...prev, fields: rest };
    });
    setHasChanges(true);
  }, []);

  const handleFieldChange = useCallback((oldName: string, newName: string, config: SchemaFieldConfig) => {
    setLocalSchema(prev => {
      const fields = { ...prev.fields };
      if (oldName !== newName) delete fields[oldName];
      fields[newName] = config;
      return { ...prev, fields };
    });
    setHasChanges(true);
  }, []);

  const handleSave = useCallback(async () => {
    if (!selectedServiceId || !selectedService) return;
    setSaveStatus('saving');
    const serviceName = selectedService.data?.label || selectedService.type || 'unknown';
    const success = await saveToolSchema(selectedServiceId, serviceName, localSchema.description, localSchema);
    setSaveStatus(success ? 'saved' : 'error');
    if (success) setHasChanges(false);
    setTimeout(() => setSaveStatus('idle'), 2000);
  }, [selectedServiceId, selectedService, localSchema, saveToolSchema]);

  const handleReset = useCallback(async () => {
    if (!selectedServiceId) return;
    await deleteToolSchema(selectedServiceId);
    setLocalSchema(getDefaultSchemaForService(selectedService));
    setHasChanges(false);
  }, [selectedServiceId, selectedService, deleteToolSchema, getDefaultSchemaForService]);

  const fieldEntries = Object.entries(localSchema.fields);

  return (
    <div style={{
      backgroundColor: theme.colors.background,
      border: `1px solid ${theme.colors.border}`,
      borderRadius: theme.borderRadius.md,
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: theme.spacing.md,
          backgroundColor: theme.colors.backgroundAlt,
          cursor: 'pointer',
          borderBottom: isExpanded ? `1px solid ${theme.colors.border}` : 'none'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm }}>
          <span>{isExpanded ? '▼' : '▶'}</span>
          <span style={{ fontWeight: theme.fontWeight.semibold, color: theme.colors.text }}>
            Connected Services
          </span>
        </div>
        <span style={{ fontSize: theme.fontSize.sm, color: theme.colors.textSecondary }}>
          {connectedServices.length} service(s)
        </span>
      </div>

      {isExpanded && (
        <div style={{ padding: theme.spacing.md }}>
          {/* Service Selector Dropdown */}
          {connectedServices.length > 0 ? (
            <div style={{ marginBottom: theme.spacing.md }}>
              <label style={{
                display: 'block',
                fontSize: theme.fontSize.sm,
                color: theme.colors.textSecondary,
                marginBottom: theme.spacing.xs
              }}>
                Select Service
              </label>
              <select
                value={selectedServiceId || ''}
                onChange={(e) => setSelectedServiceId(e.target.value)}
                style={{
                  width: '100%',
                  padding: `${theme.spacing.sm} ${theme.spacing.md}`,
                  borderRadius: theme.borderRadius.sm,
                  border: `1px solid ${theme.colors.border}`,
                  backgroundColor: theme.colors.background,
                  color: theme.colors.text,
                  fontSize: theme.fontSize.sm,
                  cursor: 'pointer'
                }}
              >
                {connectedServices.map(service => (
                  <option key={service.id} value={service.id}>
                    {service.data?.label || service.type}
                  </option>
                ))}
              </select>
              {selectedService && (
                <div style={{
                  marginTop: theme.spacing.xs,
                  fontSize: theme.fontSize.xs,
                  color: theme.colors.textMuted
                }}>
                  Type: {selectedService.type}
                </div>
              )}
            </div>
          ) : (
            <div style={{
              padding: theme.spacing.sm,
              backgroundColor: `${theme.dracula.orange}10`,
              borderRadius: theme.borderRadius.sm,
              border: `1px solid ${theme.dracula.orange}30`,
              fontSize: theme.fontSize.sm,
              color: theme.dracula.orange,
              marginBottom: theme.spacing.md
            }}>
              Connect Android nodes to the input handle
            </div>
          )}

          {/* Schema Fields */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.sm }}>
            <label style={{ fontSize: theme.fontSize.sm, color: theme.colors.textSecondary }}>
              Schema Fields
            </label>
            <button
              onClick={handleAddField}
              style={{
                padding: `2px ${theme.spacing.sm}`,
                backgroundColor: `${theme.dracula.cyan}20`,
                color: theme.dracula.cyan,
                border: `1px solid ${theme.dracula.cyan}40`,
                borderRadius: theme.borderRadius.sm,
                cursor: 'pointer',
                fontSize: theme.fontSize.xs
              }}
            >
              + Add
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.xs }}>
            {fieldEntries.map(([name, config]) => (
              <FieldRow
                key={name}
                fieldName={name}
                config={config}
                onChange={(newName, newConfig) => handleFieldChange(name, newName, newConfig)}
                onRemove={() => handleRemoveField(name)}
                theme={theme}
              />
            ))}
          </div>

          {/* Save/Reset */}
          {hasChanges && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: theme.spacing.sm, marginTop: theme.spacing.md }}>
              <button
                onClick={handleReset}
                style={{
                  padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
                  backgroundColor: 'transparent',
                  color: theme.colors.textSecondary,
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: theme.borderRadius.sm,
                  cursor: 'pointer',
                  fontSize: theme.fontSize.sm
                }}
              >
                Reset
              </button>
              <button
                onClick={handleSave}
                disabled={isLoading}
                style={{
                  padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
                  backgroundColor: `${theme.dracula.green}20`,
                  color: theme.dracula.green,
                  border: `1px solid ${theme.dracula.green}40`,
                  borderRadius: theme.borderRadius.sm,
                  cursor: 'pointer',
                  fontSize: theme.fontSize.sm
                }}
              >
                {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved!' : 'Save'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Field Row Component
const FieldRow: React.FC<{
  fieldName: string;
  config: SchemaFieldConfig;
  onChange: (newName: string, newConfig: SchemaFieldConfig) => void;
  onRemove: () => void;
  theme: any;
}> = ({ fieldName, config, onChange, onRemove, theme }) => {
  const [localName, setLocalName] = useState(fieldName);

  useEffect(() => {
    setLocalName(fieldName);
  }, [fieldName]);

  return (
    <div style={{
      padding: theme.spacing.sm,
      backgroundColor: theme.colors.backgroundAlt,
      borderRadius: theme.borderRadius.sm,
      border: `1px solid ${theme.colors.border}`
    }}>
      <div style={{ display: 'flex', gap: theme.spacing.xs, alignItems: 'center', marginBottom: '4px' }}>
        <input
          value={localName}
          onChange={(e) => setLocalName(e.target.value.replace(/\s/g, '_'))}
          onBlur={() => localName !== fieldName && onChange(localName, config)}
          style={{
            flex: 1,
            padding: '4px 8px',
            borderRadius: theme.borderRadius.sm,
            border: `1px solid ${theme.colors.border}`,
            backgroundColor: theme.colors.background,
            color: theme.colors.text,
            fontSize: theme.fontSize.sm
          }}
        />
        <select
          value={config.type}
          onChange={(e) => onChange(fieldName, { ...config, type: e.target.value as any })}
          style={{
            padding: '4px',
            borderRadius: theme.borderRadius.sm,
            border: `1px solid ${theme.colors.border}`,
            backgroundColor: theme.colors.background,
            color: theme.colors.text,
            fontSize: theme.fontSize.xs
          }}
        >
          {FIELD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: '2px', fontSize: theme.fontSize.xs, color: theme.colors.textSecondary }}>
          <input type="checkbox" checked={config.required || false} onChange={(e) => onChange(fieldName, { ...config, required: e.target.checked })} />
          Req
        </label>
        <button onClick={onRemove} style={{ padding: '2px 6px', backgroundColor: `${theme.dracula.red}20`, color: theme.dracula.red, border: 'none', borderRadius: theme.borderRadius.sm, cursor: 'pointer', fontSize: theme.fontSize.xs }}>
          X
        </button>
      </div>
      <input
        value={config.description}
        onChange={(e) => onChange(fieldName, { ...config, description: e.target.value })}
        placeholder="Description..."
        style={{
          width: '100%',
          padding: '4px 8px',
          borderRadius: theme.borderRadius.sm,
          border: `1px solid ${theme.colors.border}`,
          backgroundColor: theme.colors.background,
          color: theme.colors.text,
          fontSize: theme.fontSize.xs,
          boxSizing: 'border-box'
        }}
      />
    </div>
  );
};

export default ToolSchemaEditor;
