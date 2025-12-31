/**
 * EdgeConditionEditor - Modal for configuring edge conditions
 *
 * Allows users to set up runtime conditional branching on workflow edges.
 * Conditions are evaluated against the source node's output at runtime.
 */
import React, { useState, useEffect, useCallback } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useAppTheme } from '../hooks/useAppTheme';
import {
  EdgeCondition,
  ConditionOperator,
  OPERATORS,
  getOperatorsByCategory,
  formatConditionLabel,
  validateCondition,
} from '../types/EdgeCondition';

interface EdgeConditionEditorProps {
  isOpen: boolean;
  onClose: () => void;
  /** Current condition (if editing existing) */
  condition?: EdgeCondition;
  /** Current edge label */
  label?: string;
  /** Callback when condition is saved */
  onSave: (condition: EdgeCondition | undefined, label: string | undefined) => void;
  /** Available fields from source node output (for autocomplete) */
  availableFields?: string[];
  /** Source node name for display */
  sourceNodeName?: string;
}

const EdgeConditionEditor: React.FC<EdgeConditionEditorProps> = ({
  isOpen,
  onClose,
  condition,
  label,
  onSave,
  availableFields = [],
  sourceNodeName,
}) => {
  const theme = useAppTheme();

  // Form state
  const [field, setField] = useState(condition?.field || '');
  const [operator, setOperator] = useState<ConditionOperator>(condition?.operator || 'eq');
  const [value, setValue] = useState<string>(
    condition?.value !== undefined ? String(condition.value) : ''
  );
  const [edgeLabel, setEdgeLabel] = useState(label || '');
  const [error, setError] = useState<string | null>(null);

  // Reset form when modal opens with new condition
  useEffect(() => {
    if (isOpen) {
      setField(condition?.field || '');
      setOperator(condition?.operator || 'eq');
      setValue(condition?.value !== undefined ? String(condition.value) : '');
      setEdgeLabel(label || '');
      setError(null);
    }
  }, [isOpen, condition, label]);

  const operatorMeta = OPERATORS[operator];
  const operatorsByCategory = getOperatorsByCategory();

  const handleSave = useCallback(() => {
    // If no field specified, remove condition
    if (!field.trim()) {
      onSave(undefined, edgeLabel.trim() || undefined);
      onClose();
      return;
    }

    const newCondition: EdgeCondition = {
      field: field.trim(),
      operator,
      value: operatorMeta.requiresValue ? parseValue(value, operatorMeta.valueType) : undefined,
    };

    const validation = validateCondition(newCondition);
    if (!validation.valid) {
      setError(validation.error || 'Invalid condition');
      return;
    }

    onSave(newCondition, edgeLabel.trim() || formatConditionLabel(newCondition));
    onClose();
  }, [field, operator, value, edgeLabel, operatorMeta, onSave, onClose]);

  const handleRemoveCondition = useCallback(() => {
    onSave(undefined, undefined);
    onClose();
  }, [onSave, onClose]);

  // Parse value based on expected type
  const parseValue = (val: string, type?: string): any => {
    if (type === 'number') {
      const num = parseFloat(val);
      return isNaN(num) ? val : num;
    }
    if (type === 'boolean') {
      return val.toLowerCase() === 'true';
    }
    if (type === 'array') {
      try {
        return JSON.parse(val);
      } catch {
        return val.split(',').map(s => s.trim());
      }
    }
    return val;
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
    fontSize: theme.fontSize.base,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
    fontFamily: 'system-ui, sans-serif',
    outline: 'none',
  };

  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    cursor: 'pointer',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    marginBottom: theme.spacing.xs,
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.textSecondary,
  };

  const sectionStyle: React.CSSProperties = {
    marginBottom: theme.spacing.lg,
  };

  const buttonBaseStyle: React.CSSProperties = {
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
    cursor: 'pointer',
    border: 'none',
    transition: theme.transitions.fast,
  };

  return (
    <Dialog.Root open={isOpen}>
      <Dialog.Portal>
        <Dialog.Overlay
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(2px)',
            zIndex: 1100,
          }}
        />
        <Dialog.Content
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: theme.colors.background,
            borderRadius: theme.borderRadius.lg,
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            width: '420px',
            maxHeight: '85vh',
            display: 'flex',
            flexDirection: 'column',
            fontFamily: 'system-ui, sans-serif',
            overflow: 'hidden',
            zIndex: 1101,
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: `${theme.spacing.lg} ${theme.spacing.xl}`,
              borderBottom: `1px solid ${theme.colors.border}`,
              backgroundColor: theme.colors.backgroundPanel,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Dialog.Title
              style={{
                margin: 0,
                fontSize: theme.fontSize.lg,
                fontWeight: theme.fontWeight.semibold,
                color: theme.colors.text,
                display: 'flex',
                alignItems: 'center',
                gap: theme.spacing.sm,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={theme.dracula.cyan} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 3h5v5"/>
                <path d="M21 3l-7 7"/>
                <path d="M8 21H3v-5"/>
                <path d="M3 21l7-7"/>
              </svg>
              Edge Condition
            </Dialog.Title>
            <Dialog.Close
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                fontSize: '20px',
                cursor: 'pointer',
                color: theme.colors.textSecondary,
                padding: theme.spacing.xs,
                borderRadius: theme.borderRadius.sm,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '32px',
                height: '32px',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </Dialog.Close>
          </div>

          <Dialog.Description style={{ display: 'none' }}>
            Configure condition for edge branching
          </Dialog.Description>

          {/* Content */}
          <div style={{ padding: theme.spacing.xl, overflowY: 'auto' }}>
            {/* Source node info */}
            {sourceNodeName && (
              <div
                style={{
                  marginBottom: theme.spacing.lg,
                  padding: theme.spacing.md,
                  backgroundColor: theme.colors.backgroundPanel,
                  borderRadius: theme.borderRadius.md,
                  fontSize: theme.fontSize.sm,
                  color: theme.colors.textSecondary,
                }}
              >
                Condition evaluates output from: <strong style={{ color: theme.colors.text }}>{sourceNodeName}</strong>
              </div>
            )}

            {/* Field input */}
            <div style={sectionStyle}>
              <label style={labelStyle}>Field Path</label>
              <input
                type="text"
                value={field}
                onChange={(e) => setField(e.target.value)}
                placeholder="e.g., result.status, items.0.name"
                style={inputStyle}
                list="available-fields"
              />
              {availableFields.length > 0 && (
                <datalist id="available-fields">
                  {availableFields.map((f) => (
                    <option key={f} value={f} />
                  ))}
                </datalist>
              )}
              <div style={{ marginTop: theme.spacing.xs, fontSize: theme.fontSize.xs, color: theme.colors.textMuted }}>
                Use dot notation for nested fields (e.g., result.data.value)
              </div>
            </div>

            {/* Operator select */}
            <div style={sectionStyle}>
              <label style={labelStyle}>Operator</label>
              <select
                value={operator}
                onChange={(e) => setOperator(e.target.value as ConditionOperator)}
                style={selectStyle}
              >
                {Object.entries(operatorsByCategory).map(([category, ops]) => (
                  <optgroup key={category} label={category}>
                    {ops.map((op) => (
                      <option key={op} value={op}>
                        {OPERATORS[op].label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <div style={{ marginTop: theme.spacing.xs, fontSize: theme.fontSize.xs, color: theme.colors.textMuted }}>
                {operatorMeta.description}
              </div>
            </div>

            {/* Value input (conditional) */}
            {operatorMeta.requiresValue && (
              <div style={sectionStyle}>
                <label style={labelStyle}>
                  Value
                  {operatorMeta.valueType === 'array' && (
                    <span style={{ fontWeight: 'normal', marginLeft: theme.spacing.sm }}>
                      (comma-separated or JSON array)
                    </span>
                  )}
                </label>
                <input
                  type={operatorMeta.valueType === 'number' ? 'number' : 'text'}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder={
                    operatorMeta.valueType === 'array'
                      ? 'e.g., value1, value2 or ["a", "b"]'
                      : 'Enter comparison value'
                  }
                  style={inputStyle}
                />
              </div>
            )}

            {/* Edge label */}
            <div style={sectionStyle}>
              <label style={labelStyle}>Edge Label (optional)</label>
              <input
                type="text"
                value={edgeLabel}
                onChange={(e) => setEdgeLabel(e.target.value)}
                placeholder="Auto-generated from condition"
                style={inputStyle}
              />
              <div style={{ marginTop: theme.spacing.xs, fontSize: theme.fontSize.xs, color: theme.colors.textMuted }}>
                Displayed on the workflow canvas
              </div>
            </div>

            {/* Error message */}
            {error && (
              <div
                style={{
                  padding: theme.spacing.md,
                  backgroundColor: `${theme.colors.error}20`,
                  border: `1px solid ${theme.colors.error}40`,
                  borderRadius: theme.borderRadius.md,
                  color: theme.colors.error,
                  fontSize: theme.fontSize.sm,
                  marginBottom: theme.spacing.lg,
                }}
              >
                {error}
              </div>
            )}

            {/* Preview */}
            {field && (
              <div
                style={{
                  padding: theme.spacing.md,
                  backgroundColor: theme.colors.backgroundPanel,
                  borderRadius: theme.borderRadius.md,
                  marginBottom: theme.spacing.lg,
                }}
              >
                <div style={{ fontSize: theme.fontSize.xs, color: theme.colors.textMuted, marginBottom: theme.spacing.xs }}>
                  Preview:
                </div>
                <div style={{ fontSize: theme.fontSize.sm, color: theme.dracula.cyan, fontFamily: 'monospace' }}>
                  if output.{field} {OPERATORS[operator].label.toLowerCase()}
                  {operatorMeta.requiresValue && value && ` "${value}"`}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div
            style={{
              padding: theme.spacing.lg,
              borderTop: `1px solid ${theme.colors.border}`,
              backgroundColor: theme.colors.backgroundPanel,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            {/* Remove condition button (left side) */}
            {condition && (
              <button
                onClick={handleRemoveCondition}
                style={{
                  ...buttonBaseStyle,
                  backgroundColor: `${theme.colors.error}20`,
                  color: theme.colors.error,
                  border: `1px solid ${theme.colors.error}40`,
                }}
              >
                Remove Condition
              </button>
            )}
            {!condition && <div />}

            {/* Save/Cancel buttons (right side) */}
            <div style={{ display: 'flex', gap: theme.spacing.sm }}>
              <button
                onClick={onClose}
                style={{
                  ...buttonBaseStyle,
                  backgroundColor: 'transparent',
                  color: theme.colors.textSecondary,
                  border: `1px solid ${theme.colors.border}`,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                style={{
                  ...buttonBaseStyle,
                  backgroundColor: theme.dracula.cyan,
                  color: theme.dracula.background,
                }}
              >
                Save Condition
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export default EdgeConditionEditor;
