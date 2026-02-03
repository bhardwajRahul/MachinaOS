/**
 * MasterSkillEditor - Editor for Master Skill node
 *
 * Split panel showing available skills with enable/disable toggles on left,
 * and selected skill's markdown instructions on right.
 *
 * Skills are loaded from the skill folder (server/skills/).
 * The skillsConfig uses skillName (folder name) as keys.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Input, Checkbox, Button, Spin, List, Badge, Empty, Tooltip, Alert } from 'antd';
import { SearchOutlined, ReloadOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { useAppTheme } from '../../hooks/useAppTheme';
import { useWebSocket } from '../../contexts/WebSocketContext';
import { skillNodes, SKILL_NODE_TYPES } from '../../nodeDefinitions/skillNodes';
import CodeEditor from '../ui/CodeEditor';

// Skill configuration stored in node parameters
// Key is skillName (folder name like 'whatsapp-skill')
interface SkillConfig {
  enabled: boolean;
  instructions: string;
  isCustomized: boolean;
}

interface MasterSkillConfig {
  [skillName: string]: SkillConfig;
}

interface AvailableSkill {
  type: string;        // Node type (e.g., 'whatsappSkill')
  skillName: string;   // Skill folder name (e.g., 'whatsapp-skill') - used as config key
  displayName: string;
  icon: string;
  color: string;
  description: string;
}

interface MasterSkillEditorProps {
  skillsConfig: MasterSkillConfig;
  onConfigChange: (config: MasterSkillConfig) => void;
}

// Helper to render icon (handles emojis and SVG data URIs)
const renderSkillIcon = (icon: string, size: number = 16) => {
  if (icon.startsWith('data:') || icon.startsWith('http')) {
    return <img src={icon} alt="icon" style={{ width: size, height: size, objectFit: 'contain' }} />;
  }
  return <span style={{ fontSize: size }}>{icon}</span>;
};

const MasterSkillEditor: React.FC<MasterSkillEditorProps> = ({
  skillsConfig,
  onConfigChange
}) => {
  const theme = useAppTheme();
  const { sendRequest } = useWebSocket();
  const [selectedSkillName, setSelectedSkillName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [defaultInstructions, setDefaultInstructions] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState('');

  // Build list of available skills from node definitions
  const availableSkills = useMemo<AvailableSkill[]>(() => {
    return SKILL_NODE_TYPES
      .filter(type => type !== 'customSkill' && type !== 'masterSkill')
      .map(type => {
        const nodeDef = skillNodes[type];
        if (!nodeDef) return null;

        const skillNameProp = nodeDef.properties?.find(p => p.name === 'skillName');
        const skillName = skillNameProp?.default as string || type;

        return {
          type,
          skillName,  // This is the folder name used as config key
          displayName: nodeDef.displayName || type,
          icon: nodeDef.icon || '',
          color: (nodeDef.defaults?.color as string) || '#6366F1',
          description: nodeDef.description || ''
        };
      })
      .filter((s): s is AvailableSkill => s !== null);
  }, []);

  // Filter skills based on search query
  const filteredSkills = useMemo(() => {
    if (!searchQuery.trim()) return availableSkills;
    const query = searchQuery.toLowerCase();
    return availableSkills.filter(skill =>
      skill.displayName.toLowerCase().includes(query) ||
      skill.description.toLowerCase().includes(query)
    );
  }, [availableSkills, searchQuery]);

  // Auto-select first skill
  useEffect(() => {
    if (!selectedSkillName && availableSkills.length > 0) {
      setSelectedSkillName(availableSkills[0].skillName);
    }
  }, [selectedSkillName, availableSkills]);

  // Load skill content from skill folder
  const fetchSkillContent = useCallback(async (skillName: string): Promise<string> => {
    // Already cached
    if (defaultInstructions[skillName]) {
      return defaultInstructions[skillName];
    }

    try {
      setIsLoading(true);
      const response = await sendRequest<{ instructions: string; success: boolean; error?: string }>('get_skill_content', {
        skill_name: skillName
      });

      if (response?.success && response.instructions) {
        setDefaultInstructions(prev => ({ ...prev, [skillName]: response.instructions }));
        return response.instructions;
      } else {
        console.warn('[MasterSkillEditor] No content returned for skill:', skillName, response?.error);
      }
    } catch (error) {
      console.error('[MasterSkillEditor] Failed to load skill content:', error);
    } finally {
      setIsLoading(false);
    }
    return '';
  }, [sendRequest, defaultInstructions]);

  // Load instructions when skill is selected (for preview)
  useEffect(() => {
    if (!selectedSkillName) return;

    // Skip if already cached
    if (defaultInstructions[selectedSkillName]) return;

    // Load skill content for preview
    fetchSkillContent(selectedSkillName);
  }, [selectedSkillName, defaultInstructions, fetchSkillContent]);

  // Toggle skill enabled/disabled
  const handleToggleSkill = useCallback(async (skillName: string, enabled: boolean) => {
    const currentConfig = skillsConfig[skillName];

    if (enabled && !currentConfig?.instructions) {
      // Load default instructions when enabling for first time
      const defaultContent = await fetchSkillContent(skillName);
      onConfigChange({
        ...skillsConfig,
        [skillName]: { enabled: true, instructions: defaultContent, isCustomized: false }
      });
    } else {
      onConfigChange({
        ...skillsConfig,
        [skillName]: {
          enabled,
          instructions: currentConfig?.instructions || '',
          isCustomized: currentConfig?.isCustomized || false
        }
      });
    }
  }, [skillsConfig, onConfigChange, fetchSkillContent]);

  // Update instructions
  const handleUpdateInstructions = useCallback((skillName: string, instructions: string) => {
    const currentConfig = skillsConfig[skillName];
    const defaultContent = defaultInstructions[skillName] || '';
    const isCustomized = instructions !== defaultContent;

    onConfigChange({
      ...skillsConfig,
      [skillName]: {
        enabled: currentConfig?.enabled || false,
        instructions,
        isCustomized
      }
    });
  }, [skillsConfig, onConfigChange, defaultInstructions]);

  // Reset to default from skill folder
  const handleResetToDefault = useCallback(async (skillName: string) => {
    // Clear cache to force reload from skill folder
    setDefaultInstructions(prev => {
      const next = { ...prev };
      delete next[skillName];
      return next;
    });

    const defaultContent = await fetchSkillContent(skillName);
    const currentConfig = skillsConfig[skillName];

    onConfigChange({
      ...skillsConfig,
      [skillName]: { enabled: currentConfig?.enabled || false, instructions: defaultContent, isCustomized: false }
    });
  }, [skillsConfig, onConfigChange, fetchSkillContent]);

  const selectedSkillInfo = availableSkills.find(s => s.skillName === selectedSkillName);
  const selectedSkillConfig = selectedSkillName ? skillsConfig[selectedSkillName] : undefined;
  const enabledCount = Object.values(skillsConfig).filter(c => c?.enabled).length;

  return (
    <div style={{
      display: 'flex',
      height: '100%',
      gap: theme.spacing.md,
      overflow: 'hidden'
    }}>
      {/* Left Panel - Skills List */}
      <div style={{
        flex: '0 0 260px',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: theme.colors.background,
        borderRadius: theme.borderRadius.md,
        border: `1px solid ${theme.colors.border}`,
        overflow: 'hidden'
      }}>
        {/* Header with count */}
        <div style={{
          padding: theme.spacing.sm,
          borderBottom: `1px solid ${theme.colors.border}`,
          backgroundColor: theme.colors.backgroundAlt,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <span style={{ fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.semibold, color: theme.colors.text }}>
            Skills
          </span>
          <Badge
            count={enabledCount}
            style={{ backgroundColor: theme.dracula.purple }}
            showZero
          />
        </div>

        {/* Search */}
        <div style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>
          <Input
            placeholder="Search skills..."
            prefix={<SearchOutlined style={{ color: theme.colors.textSecondary }} />}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            allowClear
            style={{
              backgroundColor: theme.colors.background,
              borderColor: theme.colors.border,
            }}
          />
        </div>

        {/* Skills List */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filteredSkills.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="No skills found"
              style={{ marginTop: theme.spacing.lg }}
            />
          ) : (
            <List
              size="small"
              dataSource={filteredSkills}
              renderItem={(skill) => {
                const config = skillsConfig[skill.skillName];
                const isSelected = selectedSkillName === skill.skillName;
                const isEnabled = config?.enabled || false;
                const isCustomized = config?.isCustomized || false;

                return (
                  <List.Item
                    onClick={() => setSelectedSkillName(skill.skillName)}
                    style={{
                      padding: `${theme.spacing.sm} ${theme.spacing.md}`,
                      cursor: 'pointer',
                      backgroundColor: isSelected ? `${skill.color}15` : 'transparent',
                      borderLeft: isSelected ? `3px solid ${skill.color}` : '3px solid transparent',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm, width: '100%' }}>
                      <Checkbox
                        checked={isEnabled}
                        onChange={(e) => {
                          e.stopPropagation();
                          handleToggleSkill(skill.skillName, e.target.checked);
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                      {renderSkillIcon(skill.icon, 16)}
                      <span style={{
                        flex: 1,
                        fontSize: theme.fontSize.sm,
                        fontWeight: isSelected ? theme.fontWeight.semibold : theme.fontWeight.medium,
                        color: isEnabled ? theme.colors.text : theme.colors.textSecondary,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {skill.displayName}
                      </span>
                      {isCustomized && (
                        <Tooltip title="Customized">
                          <div style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            backgroundColor: theme.dracula.orange,
                            flexShrink: 0
                          }} />
                        </Tooltip>
                      )}
                    </div>
                  </List.Item>
                );
              }}
            />
          )}
        </div>
      </div>

      {/* Right Panel - Skill Editor */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: theme.colors.background,
        borderRadius: theme.borderRadius.md,
        border: `1px solid ${theme.colors.border}`,
        overflow: 'hidden'
      }}>
        {selectedSkillInfo ? (
          <>
            {/* Skill Header */}
            <div style={{
              padding: theme.spacing.md,
              borderBottom: `1px solid ${theme.colors.border}`,
              backgroundColor: theme.colors.backgroundAlt,
              display: 'flex',
              alignItems: 'center',
              gap: theme.spacing.md
            }}>
              {renderSkillIcon(selectedSkillInfo.icon, 24)}
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: theme.fontSize.sm,
                  fontWeight: theme.fontWeight.semibold,
                  color: theme.colors.text,
                  display: 'flex',
                  alignItems: 'center',
                  gap: theme.spacing.sm
                }}>
                  {selectedSkillInfo.displayName}
                  {selectedSkillConfig?.isCustomized && (
                    <Badge
                      count="Customized"
                      style={{
                        backgroundColor: `${theme.dracula.orange}20`,
                        color: theme.dracula.orange,
                        fontSize: theme.fontSize.xs
                      }}
                    />
                  )}
                </div>
                <div style={{ fontSize: theme.fontSize.xs, color: theme.colors.textSecondary, marginTop: 2 }}>
                  {selectedSkillInfo.description}
                </div>
              </div>

              {/* Reset Button */}
              {selectedSkillConfig?.isCustomized && (
                <Button
                  icon={<ReloadOutlined />}
                  size="small"
                  onClick={() => handleResetToDefault(selectedSkillName!)}
                  loading={isLoading}
                  style={{
                    backgroundColor: `${theme.dracula.orange}15`,
                    borderColor: `${theme.dracula.orange}40`,
                    color: theme.dracula.orange,
                  }}
                >
                  Reset
                </Button>
              )}
            </div>

            {/* Code Editor */}
            <div style={{ flex: 1, padding: theme.spacing.md, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              {isLoading ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Spin tip="Loading..." />
                </div>
              ) : (
                <div style={{ flex: 1, minHeight: 0 }}>
                  <CodeEditor
                    value={selectedSkillConfig?.instructions || defaultInstructions[selectedSkillName!] || ''}
                    onChange={(value) => handleUpdateInstructions(selectedSkillName!, value)}
                    language="markdown"
                    placeholder="Loading skill instructions..."
                  />
                </div>
              )}

              {/* Enable hint */}
              {!selectedSkillConfig?.enabled && (
                <Alert
                  type="info"
                  showIcon
                  icon={<InfoCircleOutlined />}
                  message="Enable this skill to include it when running the AI Agent."
                  style={{
                    marginTop: theme.spacing.md,
                    backgroundColor: `${theme.dracula.cyan}10`,
                    border: `1px solid ${theme.dracula.cyan}30`,
                  }}
                />
              )}
            </div>
          </>
        ) : (
          <Empty
            description="Select a skill to view instructions"
            style={{ margin: 'auto' }}
          />
        )}
      </div>
    </div>
  );
};

export default MasterSkillEditor;
