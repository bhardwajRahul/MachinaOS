import React, { useState, useEffect, useCallback } from 'react';
import Modal from './ui/Modal';
import CodeEditor from './ui/CodeEditor';
import { useAppTheme } from '../hooks/useAppTheme';
import { useWebSocket } from '../contexts/WebSocketContext';

interface UserSkill {
  id?: number;
  name: string;
  display_name: string;
  description: string;
  instructions: string;
  allowed_tools: string[];
  category: string;
  icon: string;
  color: string;
  is_active: boolean;
}

interface SkillEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  skill?: UserSkill | null;
  onSave?: (skill: UserSkill) => void;
}

const DEFAULT_SKILL: UserSkill = {
  name: '',
  display_name: '',
  description: '',
  instructions: `# My Custom Skill

## Capabilities
- Describe what this skill can do
- List the main functions

## Usage
Explain when and how the Zeenie should use this skill.

## Examples

**User**: "Example request"
**Action**: Describe what the skill does in response
`,
  allowed_tools: [],
  category: 'custom',
  icon: 'star',
  color: '#6366F1',
  is_active: true
};

const ICON_OPTIONS = [
  { value: 'star', label: 'Star', icon: '...' },
  { value: 'sparkles', label: 'Sparkles', icon: '...' },
  { value: 'brain', label: 'Brain', icon: '...' },
  { value: 'code', label: 'Code', icon: '...' },
  { value: 'globe', label: 'Globe', icon: '...' },
  { value: 'chat', label: 'Chat', icon: '...' },
  { value: 'calendar', label: 'Calendar', icon: '...' },
  { value: 'settings', label: 'Settings', icon: '...' },
];

const CATEGORY_OPTIONS = [
  { value: 'custom', label: 'Custom' },
  { value: 'communication', label: 'Communication' },
  { value: 'productivity', label: 'Productivity' },
  { value: 'automation', label: 'Automation' },
  { value: 'integration', label: 'Integration' },
  { value: 'utility', label: 'Utility' },
];

const COLOR_OPTIONS = [
  '#6366F1', // Indigo
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#EF4444', // Red
  '#F59E0B', // Amber
  '#10B981', // Emerald
  '#3B82F6', // Blue
  '#06B6D4', // Cyan
];

const SkillEditorModal: React.FC<SkillEditorModalProps> = ({
  isOpen,
  onClose,
  skill,
  onSave
}) => {
  const theme = useAppTheme();
  const { sendRequest } = useWebSocket();
  const [formData, setFormData] = useState<UserSkill>(DEFAULT_SKILL);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'details' | 'instructions'>('details');

  // Reset form when skill changes or modal opens
  useEffect(() => {
    if (isOpen) {
      if (skill) {
        setFormData(skill);
      } else {
        setFormData(DEFAULT_SKILL);
      }
      setError(null);
    }
  }, [isOpen, skill]);

  const handleInputChange = useCallback((field: keyof UserSkill, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleNameChange = useCallback((value: string) => {
    // Auto-generate internal name from display name (lowercase, hyphenated)
    const internalName = value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    setFormData(prev => ({
      ...prev,
      display_name: value,
      name: prev.id ? prev.name : internalName // Only auto-generate for new skills
    }));
  }, []);

  const validateForm = (): boolean => {
    if (!formData.name.trim()) {
      setError('Skill name is required');
      return false;
    }
    if (!formData.display_name.trim()) {
      setError('Display name is required');
      return false;
    }
    if (!formData.description.trim()) {
      setError('Description is required');
      return false;
    }
    if (!formData.instructions.trim()) {
      setError('Instructions are required');
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setIsSaving(true);
    setError(null);

    try {
      const messageType = skill?.id ? 'update_user_skill' : 'create_user_skill';
      const response = await sendRequest(messageType, {
        ...formData,
        allowed_tools: formData.allowed_tools.join(',')
      });

      if (response?.success) {
        onSave?.(response.skill);
        onClose();
      } else {
        setError(response?.error || 'Failed to save skill');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save skill');
    } finally {
      setIsSaving(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: theme.spacing.sm,
    backgroundColor: theme.colors.backgroundAlt,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.md,
    color: theme.colors.text,
    fontSize: theme.fontSize.sm,
    outline: 'none'
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    marginBottom: theme.spacing.xs,
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    fontWeight: theme.fontWeight.medium
  };

  const tabStyle = (isActive: boolean): React.CSSProperties => ({
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
    backgroundColor: isActive ? theme.colors.backgroundPanel : 'transparent',
    border: 'none',
    borderBottom: isActive ? `2px solid ${theme.dracula.purple}` : '2px solid transparent',
    color: isActive ? theme.colors.text : theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={skill?.id ? 'Edit Skill' : 'Create Skill'}
      maxWidth="700px"
      maxHeight="85vh"
    >
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Tabs */}
        <div style={{
          display: 'flex',
          borderBottom: `1px solid ${theme.colors.border}`,
          backgroundColor: theme.colors.background
        }}>
          <button style={tabStyle(activeTab === 'details')} onClick={() => setActiveTab('details')}>
            Details
          </button>
          <button style={tabStyle(activeTab === 'instructions')} onClick={() => setActiveTab('instructions')}>
            Instructions
          </button>
        </div>

        {/* Tab Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: theme.spacing.lg }}>
          {activeTab === 'details' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.lg }}>
              {/* Display Name */}
              <div>
                <label style={labelStyle}>Display Name *</label>
                <input
                  type="text"
                  value={formData.display_name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="My Custom Skill"
                  style={inputStyle}
                />
              </div>

              {/* Internal Name (readonly for existing skills) */}
              <div>
                <label style={labelStyle}>Internal Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                  placeholder="my-custom-skill"
                  style={{ ...inputStyle, opacity: skill?.id ? 0.7 : 1 }}
                  readOnly={!!skill?.id}
                />
                <span style={{ fontSize: theme.fontSize.xs, color: theme.colors.textMuted }}>
                  Used internally to identify the skill
                </span>
              </div>

              {/* Description */}
              <div>
                <label style={labelStyle}>Description *</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="A short description of what this skill does..."
                  rows={3}
                  style={{ ...inputStyle, resize: 'vertical', minHeight: '80px' }}
                />
                <span style={{ fontSize: theme.fontSize.xs, color: theme.colors.textMuted }}>
                  This appears in the skill registry to help the Zeenie decide when to use it
                </span>
              </div>

              {/* Category & Color Row */}
              <div style={{ display: 'flex', gap: theme.spacing.lg }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => handleInputChange('category', e.target.value)}
                    style={inputStyle}
                  >
                    {CATEGORY_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Color</label>
                  <div style={{ display: 'flex', gap: theme.spacing.xs, flexWrap: 'wrap' }}>
                    {COLOR_OPTIONS.map(color => (
                      <button
                        key={color}
                        onClick={() => handleInputChange('color', color)}
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: theme.borderRadius.sm,
                          backgroundColor: color,
                          border: formData.color === color ? '2px solid white' : 'none',
                          cursor: 'pointer',
                          boxShadow: formData.color === color ? `0 0 0 2px ${color}` : 'none'
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Icon */}
              <div>
                <label style={labelStyle}>Icon</label>
                <select
                  value={formData.icon}
                  onChange={(e) => handleInputChange('icon', e.target.value)}
                  style={inputStyle}
                >
                  {ICON_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {/* Active Toggle */}
              <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm }}>
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => handleInputChange('is_active', e.target.checked)}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <label style={{ ...labelStyle, margin: 0 }}>Skill is active</label>
              </div>
            </div>
          )}

          {activeTab === 'instructions' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.md, height: '100%' }}>
              <div style={{ fontSize: theme.fontSize.sm, color: theme.colors.textSecondary }}>
                Write markdown instructions for the Zeenie. Include capabilities, usage guidelines, and examples.
              </div>
              <div style={{ flex: 1, minHeight: '400px' }}>
                <CodeEditor
                  value={formData.instructions}
                  onChange={(value) => handleInputChange('instructions', value)}
                  language="markdown"
                  placeholder="# Skill Instructions

## Capabilities
- ...

## Usage
...

## Examples
..."
                />
              </div>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div style={{
            padding: theme.spacing.md,
            backgroundColor: `${theme.dracula.red}20`,
            color: theme.dracula.red,
            fontSize: theme.fontSize.sm,
            borderTop: `1px solid ${theme.colors.border}`
          }}>
            {error}
          </div>
        )}

        {/* Footer */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: theme.spacing.md,
          padding: theme.spacing.lg,
          borderTop: `1px solid ${theme.colors.border}`,
          backgroundColor: theme.colors.backgroundPanel
        }}>
          <button
            onClick={onClose}
            style={{
              padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
              backgroundColor: 'transparent',
              border: `1px solid ${theme.colors.border}`,
              borderRadius: theme.borderRadius.md,
              color: theme.colors.text,
              fontSize: theme.fontSize.sm,
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            style={{
              padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
              backgroundColor: theme.dracula.purple,
              border: 'none',
              borderRadius: theme.borderRadius.md,
              color: 'white',
              fontSize: theme.fontSize.sm,
              fontWeight: theme.fontWeight.medium,
              cursor: isSaving ? 'not-allowed' : 'pointer',
              opacity: isSaving ? 0.7 : 1
            }}
          >
            {isSaving ? 'Saving...' : (skill?.id ? 'Update Skill' : 'Create Skill')}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default SkillEditorModal;
