/**
 * MasterSkillEditor - Editor for Master Skill node
 *
 * Split panel: left side has folder input, search, and skill toggles.
 * Right side shows selected skill's markdown instructions.
 *
 * Skills loaded from skillFolder (server/skills/<folder>/) or built-in list.
 * The skillsConfig uses skillName (folder name) as keys.
 *
 * User skills are created/edited inline in the right panel (no modal).
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Input, Select, Checkbox, Button, Spin, List, Badge, Empty, Tooltip, Alert, Popconfirm, message } from 'antd';
import { SearchOutlined, ReloadOutlined, InfoCircleOutlined, FolderOutlined, PlusOutlined, DeleteOutlined, SaveOutlined, CloseOutlined } from '@ant-design/icons';
import { useAppTheme } from '../../hooks/useAppTheme';
import { useWebSocket } from '../../contexts/WebSocketContext';
import { skillNodes, SKILL_NODE_TYPES } from '../../nodeDefinitions/skillNodes';

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
  isUserSkill?: boolean;  // True if this is a user-created skill from database
}

// User skill from database
interface UserSkill {
  name: string;
  display_name: string;
  description: string;
  instructions: string;
  icon: string;
  color: string;
  category: string;
  is_active: boolean;
}

// Pending skill data for create/edit
interface PendingSkillData {
  name: string;
  display_name: string;
  description: string;
  instructions: string;
  icon: string;
  color: string;
}

interface MasterSkillEditorProps {
  skillsConfig: MasterSkillConfig;
  onConfigChange: (config: MasterSkillConfig) => void;
  skillFolder?: string;
  onSkillFolderChange?: (folder: string) => void;
  nodeId?: string;  // For persisting skillsConfig to database
}

// Lookup icon/color from skillNodes.ts definitions by skill name
const getNodeDefaults = (skillName: string): { icon: string; color: string } => {
  for (const type of SKILL_NODE_TYPES) {
    const nodeDef = skillNodes[type];
    if (!nodeDef) continue;
    const skillNameProp = nodeDef.properties?.find(p => p.name === 'skillName');
    if (skillNameProp?.default === skillName) {
      return {
        icon: nodeDef.icon || '',
        color: (nodeDef.defaults?.color as string) || '#6366F1'
      };
    }
  }
  return { icon: '', color: '' };
};

// Helper to render icon (handles emojis and SVG data URIs)
const renderSkillIcon = (icon: string, size: number = 16) => {
  if (icon.startsWith('data:') || icon.startsWith('http')) {
    return <img src={icon} alt="icon" style={{ width: size, height: size, objectFit: 'contain' }} />;
  }
  return <span style={{ fontSize: size }}>{icon}</span>;
};

const MasterSkillEditor: React.FC<MasterSkillEditorProps> = ({
  skillsConfig,
  onConfigChange,
  skillFolder,
  onSkillFolderChange,
  nodeId
}) => {
  const theme = useAppTheme();
  const { sendRequest } = useWebSocket();
  const [selectedSkillName, setSelectedSkillName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [defaultInstructions, setDefaultInstructions] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [folderSkills, setFolderSkills] = useState<AvailableSkill[]>([]);
  const [folderLoading, setFolderLoading] = useState(false);
  const [availableFolders, setAvailableFolders] = useState<Array<{ name: string; skill_count: number }>>([]);
  const [foldersLoaded, setFoldersLoaded] = useState(false);
  const hasFetchedFolders = useRef(false);
  const editorWrapperRef = useRef<HTMLDivElement>(null);

  // User skills from database
  const [userSkills, setUserSkills] = useState<UserSkill[]>([]);

  // Inline editing state (no modal)
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [pendingSkillData, setPendingSkillData] = useState<PendingSkillData | null>(null);
  const [savingSkill, setSavingSkill] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Native DOM keydown handler to stop React Flow's document-level listeners
  // from intercepting standard text editing shortcuts (Ctrl+A, Ctrl+C, etc.)
  useEffect(() => {
    const el = editorWrapperRef.current;
    if (!el) return;

    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.stopPropagation();
      }
    };
    el.addEventListener('keydown', handler);
    return () => el.removeEventListener('keydown', handler);
  });

  // Fetch available skill folders on mount
  useEffect(() => {
    if (hasFetchedFolders.current) return;
    hasFetchedFolders.current = true;

    const fetchFolders = async () => {
      try {
        const response = await sendRequest<{
          success: boolean;
          folders: Array<{ name: string; skill_count: number }>;
        }>('list_skill_folders', {});

        if (response?.success && response.folders) {
          setAvailableFolders(response.folders);
        }
      } catch (error) {
        console.error('[MasterSkillEditor] Failed to list skill folders:', error);
      } finally {
        setFoldersLoaded(true);
      }
    };

    fetchFolders();
  }, [sendRequest]);

  // Fetch user-created skills from database
  const fetchUserSkills = useCallback(async () => {
    try {
      const response = await sendRequest<{ skills: UserSkill[]; count: number }>('get_user_skills', { active_only: false });
      if (response?.skills) {
        setUserSkills(response.skills);
      }
    } catch (error) {
      console.error('[MasterSkillEditor] Failed to fetch user skills:', error);
    }
  }, [sendRequest]);

  useEffect(() => {
    fetchUserSkills();
  }, [fetchUserSkills]);

  // Fetch skills from folder when skillFolder is set
  useEffect(() => {
    if (!skillFolder) {
      setFolderSkills([]);
      return;
    }

    const fetchFolderSkills = async () => {
      setFolderLoading(true);
      try {
        const response = await sendRequest<{
          success: boolean;
          skills: Array<{ name: string; description: string; metadata?: Record<string, any> }>;
          error?: string;
        }>('scan_skill_folder', { folder: skillFolder });

        if (response?.success && response.skills) {
          setFolderSkills(response.skills.map(s => {
            const defaults = getNodeDefaults(s.name);
            return {
              type: s.name,
              skillName: s.name,
              displayName: s.name.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' '),
              icon: defaults.icon || s.metadata?.icon || '',
              color: defaults.color || s.metadata?.color || '#6366F1',
              description: s.description || ''
            };
          }));
        }
      } catch (error) {
        console.error('[MasterSkillEditor] Failed to scan skill folder:', error);
      } finally {
        setFolderLoading(false);
      }
    };

    fetchFolderSkills();
  }, [skillFolder, sendRequest]);

  // Build list of available skills - from folder scan, node definitions, and user skills
  const availableSkills = useMemo<AvailableSkill[]>(() => {
    const skills: AvailableSkill[] = [];

    // Add folder skills if available
    if (skillFolder && folderSkills.length > 0) {
      skills.push(...folderSkills);
    } else {
      // Add built-in skills from node definitions
      SKILL_NODE_TYPES
        .filter(type => type !== 'customSkill' && type !== 'masterSkill')
        .forEach(type => {
          const nodeDef = skillNodes[type];
          if (!nodeDef) return;

          const skillNameProp = nodeDef.properties?.find(p => p.name === 'skillName');
          const skillName = skillNameProp?.default as string || type;

          skills.push({
            type,
            skillName,
            displayName: nodeDef.displayName || type,
            icon: nodeDef.icon || '',
            color: (nodeDef.defaults?.color as string) || '#6366F1',
            description: nodeDef.description || ''
          });
        });
    }

    // Add user-created skills
    userSkills.forEach(us => {
      skills.push({
        type: 'userSkill',
        skillName: us.name,
        displayName: us.display_name,
        icon: us.icon || '',
        color: us.color || '#6366F1',
        description: us.description || '',
        isUserSkill: true
      });
    });

    return skills;
  }, [skillFolder, folderSkills, userSkills]);

  // Filter skills based on search query
  const filteredSkills = useMemo(() => {
    if (!searchQuery.trim()) return availableSkills;
    const query = searchQuery.toLowerCase();
    return availableSkills.filter(skill =>
      skill.displayName.toLowerCase().includes(query) ||
      skill.description.toLowerCase().includes(query)
    );
  }, [availableSkills, searchQuery]);

  // Clean up skillsConfig - remove skills that no longer exist in availableSkills
  useEffect(() => {
    if (availableSkills.length === 0) return; // Wait for skills to load

    const availableSkillNames = new Set(availableSkills.map(s => s.skillName));
    const configSkillNames = Object.keys(skillsConfig);
    const staleSkills = configSkillNames.filter(name => !availableSkillNames.has(name));

    if (staleSkills.length > 0) {
      console.log('[MasterSkillEditor] Removing stale skills from config:', staleSkills);
      const cleanedConfig = { ...skillsConfig };
      staleSkills.forEach(name => delete cleanedConfig[name]);
      onConfigChange(cleanedConfig);

      // Clear selection if selected skill was stale
      if (selectedSkillName && staleSkills.includes(selectedSkillName)) {
        setSelectedSkillName(null);
        setPendingSkillData(null);
      }
    }
  }, [availableSkills, skillsConfig, onConfigChange, selectedSkillName]);

  // Auto-select first skill
  useEffect(() => {
    if (!selectedSkillName && !isCreatingNew && availableSkills.length > 0) {
      setSelectedSkillName(availableSkills[0].skillName);
    }
  }, [selectedSkillName, isCreatingNew, availableSkills]);

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
    if (!selectedSkillName || isCreatingNew) return;

    // Skip if skill doesn't exist in availableSkills (may have been deleted)
    const skillExists = availableSkills.some(s => s.skillName === selectedSkillName);
    if (!skillExists) return;

    // Skip if already cached
    if (defaultInstructions[selectedSkillName]) return;

    // Load skill content for preview
    fetchSkillContent(selectedSkillName);
  }, [selectedSkillName, isCreatingNew, defaultInstructions, fetchSkillContent, availableSkills]);

  // When selecting a user skill, load its data into pendingSkillData for editing
  useEffect(() => {
    if (isCreatingNew || !selectedSkillName) {
      return;
    }

    const selectedInfo = availableSkills.find(s => s.skillName === selectedSkillName);
    if (selectedInfo?.isUserSkill) {
      const userSkill = userSkills.find(us => us.name === selectedSkillName);
      if (userSkill) {
        setPendingSkillData({
          name: userSkill.name,
          display_name: userSkill.display_name,
          description: userSkill.description,
          instructions: userSkill.instructions,
          icon: userSkill.icon || '',
          color: userSkill.color || '#6366F1'
        });
        setHasUnsavedChanges(false);
      }
    } else {
      setPendingSkillData(null);
      setHasUnsavedChanges(false);
    }
  }, [selectedSkillName, isCreatingNew, availableSkills, userSkills]);

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

  // Update instructions (for built-in skills)
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

  // Create new skill - show inline editor
  const handleCreateSkill = useCallback(() => {
    setIsCreatingNew(true);
    setSelectedSkillName(null);
    setPendingSkillData({
      name: '',
      display_name: '',
      description: '',
      instructions: '# Skill Instructions\n\nDescribe what this skill does and how the AI should use it.',
      icon: '',
      color: '#6366F1'
    });
    setHasUnsavedChanges(false);
  }, []);

  // Cancel creating new skill
  const handleCancelCreate = useCallback(() => {
    setIsCreatingNew(false);
    setPendingSkillData(null);
    setHasUnsavedChanges(false);
    // Select first available skill
    if (availableSkills.length > 0) {
      setSelectedSkillName(availableSkills[0].skillName);
    }
  }, [availableSkills]);

  // Update pending skill data
  const handlePendingDataChange = useCallback((field: keyof PendingSkillData, value: string) => {
    setPendingSkillData(prev => prev ? { ...prev, [field]: value } : null);
    setHasUnsavedChanges(true);
  }, []);

  // Save skill (create or update)
  const handleSaveSkill = useCallback(async () => {
    if (!pendingSkillData) return;

    // Validate required fields
    if (!pendingSkillData.display_name.trim()) {
      message.error('Display name is required');
      return;
    }
    if (!pendingSkillData.instructions.trim()) {
      message.error('Instructions are required');
      return;
    }

    // For new skills, generate name from display_name if not provided
    let skillName = pendingSkillData.name;
    if (isCreatingNew) {
      if (!skillName.trim()) {
        skillName = pendingSkillData.display_name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '');
      }
      if (!skillName || !/^[a-z0-9-]+$/.test(skillName)) {
        message.error('Invalid skill ID. Use lowercase letters, numbers, and hyphens only.');
        return;
      }
    }

    setSavingSkill(true);
    try {
      const handler = isCreatingNew ? 'create_user_skill' : 'update_user_skill';
      const payload = {
        name: skillName,
        display_name: pendingSkillData.display_name,
        description: pendingSkillData.description,
        instructions: pendingSkillData.instructions,
        icon: pendingSkillData.icon,
        color: pendingSkillData.color,
        category: skillFolder || 'custom',
        is_active: true
      };

      const result = await sendRequest<{ skill?: UserSkill; success?: boolean; error?: string }>(handler, payload);

      if (result.skill || result.success) {
        message.success(isCreatingNew ? 'Skill created' : 'Skill saved');
        await fetchUserSkills();

        if (isCreatingNew) {
          // Add to config as enabled
          onConfigChange({
            ...skillsConfig,
            [skillName]: { enabled: true, instructions: pendingSkillData.instructions, isCustomized: false }
          });
          setIsCreatingNew(false);
          setSelectedSkillName(skillName);
        }
        setHasUnsavedChanges(false);
      } else {
        message.error(result.error || 'Failed to save skill');
      }
    } catch (err: any) {
      message.error(err.message || 'Failed to save skill');
    } finally {
      setSavingSkill(false);
    }
  }, [pendingSkillData, isCreatingNew, skillFolder, sendRequest, fetchUserSkills, skillsConfig, onConfigChange]);

  // Delete user skill
  const handleDeleteSkill = useCallback(async (skillName: string) => {
    try {
      const result = await sendRequest<{ success: boolean; error?: string }>('delete_user_skill', { name: skillName });
      if (result.success) {
        message.success('Skill deleted');
        // Remove from config
        const newConfig = { ...skillsConfig };
        delete newConfig[skillName];
        onConfigChange(newConfig);

        // Persist cleaned config to database so deleted skill doesn't reappear
        if (nodeId) {
          await sendRequest('save_node_parameters', {
            node_id: nodeId,
            parameters: { skillsConfig: newConfig, skillFolder: skillFolder || 'assistant' }
          });
        }

        // Clear selection if deleted skill was selected
        if (selectedSkillName === skillName) {
          setSelectedSkillName(null);
          setPendingSkillData(null);
        }
        // Refresh user skills list from database
        await fetchUserSkills();
      } else {
        message.error(result.error || 'Failed to delete skill');
      }
    } catch (err: any) {
      message.error(err.message || 'Failed to delete skill');
    }
  }, [sendRequest, fetchUserSkills, skillsConfig, onConfigChange, selectedSkillName, nodeId, skillFolder]);

  const selectedSkillInfo = availableSkills.find(s => s.skillName === selectedSkillName);
  const selectedSkillConfig = selectedSkillName ? skillsConfig[selectedSkillName] : undefined;
  const enabledCount = Object.values(skillsConfig).filter(c => c?.enabled).length;
  const isEditingUserSkill = selectedSkillInfo?.isUserSkill && pendingSkillData;

  return (
    <div style={{
      display: 'flex',
      flex: 1,
      minHeight: 0,
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
        {/* Header with count and create button */}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.xs }}>
            <Badge count={enabledCount} style={{ backgroundColor: theme.dracula.purple }} showZero />
            <Tooltip title="Create new skill">
              <Button
                size="small"
                icon={<PlusOutlined />}
                onClick={handleCreateSkill}
                disabled={isCreatingNew}
                style={{
                  backgroundColor: `${theme.dracula.green}20`,
                  borderColor: theme.dracula.green,
                  color: theme.dracula.green,
                }}
              />
            </Tooltip>
          </div>
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

        {/* Skill Folder Dropdown */}
        <div style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}`, flexShrink: 0 }}>
          <Select
            value={skillFolder || 'assistant'}
            onChange={(value) => {
              onSkillFolderChange?.(value);
              setSelectedSkillName(null);
            }}
            loading={!foldersLoaded}
            disabled={!foldersLoaded}
            getPopupContainer={(trigger) => trigger.parentElement || document.body}
            style={{ width: '100%' }}
            suffixIcon={<FolderOutlined style={{ color: theme.colors.textSecondary }} />}
            options={availableFolders.map(f => ({
              value: f.name,
              label: `${f.name} (${f.skill_count})`,
            }))}
          />
        </div>

        {/* Skills List */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {folderLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: theme.spacing.lg }}>
              <Spin tip="Scanning folder..." />
            </div>
          ) : filteredSkills.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={skillFolder ? `No skills found in skills/${skillFolder}/` : 'No skills found'}
              style={{ marginTop: theme.spacing.lg }}
            />
          ) : (
            <List
              size="small"
              dataSource={filteredSkills}
              renderItem={(skill) => {
                const config = skillsConfig[skill.skillName];
                const isSelected = selectedSkillName === skill.skillName && !isCreatingNew;
                const isEnabled = config?.enabled || false;
                const isCustomized = config?.isCustomized || false;

                return (
                  <List.Item
                    onClick={() => {
                      if (isCreatingNew) {
                        // Confirm cancel if creating new
                        if (hasUnsavedChanges) {
                          if (!confirm('Discard unsaved changes?')) return;
                        }
                        setIsCreatingNew(false);
                      }
                      setSelectedSkillName(skill.skillName);
                    }}
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
                      {renderSkillIcon(skill.icon || '', 16)}
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
                      {skill.isUserSkill && (
                        <Badge
                          count="Custom"
                          style={{
                            backgroundColor: `${theme.dracula.cyan}20`,
                            color: theme.dracula.cyan,
                            fontSize: 10,
                            padding: '0 4px',
                            height: 16,
                            lineHeight: '16px'
                          }}
                        />
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
        {/* Creating new skill */}
        {isCreatingNew && pendingSkillData ? (
          <>
            {/* New Skill Header */}
            <div style={{
              padding: theme.spacing.md,
              borderBottom: `1px solid ${theme.colors.border}`,
              backgroundColor: theme.colors.backgroundAlt,
              display: 'flex',
              alignItems: 'center',
              gap: theme.spacing.md
            }}>
              <div style={{
                width: 40,
                height: 40,
                borderRadius: theme.borderRadius.md,
                backgroundColor: `${pendingSkillData.color}20`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: `2px dashed ${pendingSkillData.color}`
              }}>
                {pendingSkillData.icon ? renderSkillIcon(pendingSkillData.icon, 20) : <PlusOutlined style={{ color: pendingSkillData.color }} />}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: theme.fontSize.sm,
                  fontWeight: theme.fontWeight.semibold,
                  color: theme.dracula.green
                }}>
                  Create New Skill
                </div>
                <div style={{ fontSize: theme.fontSize.xs, color: theme.colors.textSecondary, marginTop: 2 }}>
                  Fill in the details below and save
                </div>
              </div>
              <Button
                icon={<CloseOutlined />}
                size="small"
                onClick={handleCancelCreate}
                style={{
                  backgroundColor: `${theme.dracula.red}15`,
                  borderColor: `${theme.dracula.red}40`,
                  color: theme.dracula.red,
                }}
              >
                Cancel
              </Button>
              <Button
                icon={<SaveOutlined />}
                size="small"
                onClick={handleSaveSkill}
                loading={savingSkill}
                style={{
                  backgroundColor: `${theme.dracula.green}15`,
                  borderColor: `${theme.dracula.green}40`,
                  color: theme.dracula.green,
                }}
              >
                Save
              </Button>
            </div>

            {/* New Skill Form */}
            <div ref={editorWrapperRef} style={{ flex: 1, padding: theme.spacing.md, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: theme.spacing.md }}>
              {/* Display Name */}
              <div>
                <label style={{ display: 'block', fontSize: theme.fontSize.xs, color: theme.colors.textSecondary, marginBottom: 4 }}>
                  Display Name *
                </label>
                <Input
                  value={pendingSkillData.display_name}
                  onChange={(e) => handlePendingDataChange('display_name', e.target.value)}
                  placeholder="My Custom Skill"
                  style={{ backgroundColor: theme.colors.backgroundAlt, borderColor: theme.colors.border }}
                />
              </div>

              {/* Description */}
              <div>
                <label style={{ display: 'block', fontSize: theme.fontSize.xs, color: theme.colors.textSecondary, marginBottom: 4 }}>
                  Description
                </label>
                <Input
                  value={pendingSkillData.description}
                  onChange={(e) => handlePendingDataChange('description', e.target.value)}
                  placeholder="Brief description of what this skill does"
                  style={{ backgroundColor: theme.colors.backgroundAlt, borderColor: theme.colors.border }}
                />
              </div>

              {/* Icon and Color */}
              <div style={{ display: 'flex', gap: theme.spacing.md }}>
                <div style={{ width: 100 }}>
                  <label style={{ display: 'block', fontSize: theme.fontSize.xs, color: theme.colors.textSecondary, marginBottom: 4 }}>
                    Icon (emoji)
                  </label>
                  <Input
                    value={pendingSkillData.icon}
                    onChange={(e) => handlePendingDataChange('icon', e.target.value)}
                    placeholder=""
                    style={{ backgroundColor: theme.colors.backgroundAlt, borderColor: theme.colors.border, textAlign: 'center' }}
                  />
                </div>
                <div style={{ width: 80 }}>
                  <label style={{ display: 'block', fontSize: theme.fontSize.xs, color: theme.colors.textSecondary, marginBottom: 4 }}>
                    Color
                  </label>
                  <Input
                    type="color"
                    value={pendingSkillData.color}
                    onChange={(e) => handlePendingDataChange('color', e.target.value)}
                    style={{ backgroundColor: theme.colors.backgroundAlt, borderColor: theme.colors.border, height: 32, padding: 2 }}
                  />
                </div>
              </div>

              {/* Instructions */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 200 }}>
                <label style={{ display: 'block', fontSize: theme.fontSize.xs, color: theme.colors.textSecondary, marginBottom: 4 }}>
                  Instructions *
                </label>
                <Input.TextArea
                  value={pendingSkillData.instructions}
                  onChange={(e) => handlePendingDataChange('instructions', e.target.value)}
                  placeholder="# Skill Instructions..."
                  spellCheck={false}
                  autoSize={false}
                  style={{
                    flex: 1,
                    minHeight: 0,
                    resize: 'none',
                    fontFamily: "'Consolas', 'Monaco', 'Fira Code', monospace",
                    fontSize: 13,
                    lineHeight: 1.5,
                    backgroundColor: theme.colors.backgroundAlt,
                    color: theme.colors.text,
                    borderColor: theme.colors.border,
                    borderRadius: theme.borderRadius.md,
                  }}
                />
              </div>
            </div>
          </>
        ) : selectedSkillInfo ? (
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
              {renderSkillIcon(selectedSkillInfo.icon || '', 24)}
              <div style={{ flex: 1 }}>
                {isEditingUserSkill ? (
                  <Input
                    value={pendingSkillData?.display_name || ''}
                    onChange={(e) => handlePendingDataChange('display_name', e.target.value)}
                    style={{
                      fontSize: theme.fontSize.sm,
                      fontWeight: theme.fontWeight.semibold,
                      backgroundColor: theme.colors.background,
                      borderColor: theme.colors.border,
                      marginBottom: 4
                    }}
                  />
                ) : (
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
                )}
                {isEditingUserSkill ? (
                  <Input
                    value={pendingSkillData?.description || ''}
                    onChange={(e) => handlePendingDataChange('description', e.target.value)}
                    placeholder="Description"
                    style={{
                      fontSize: theme.fontSize.xs,
                      backgroundColor: theme.colors.background,
                      borderColor: theme.colors.border,
                    }}
                  />
                ) : (
                  <div style={{ fontSize: theme.fontSize.xs, color: theme.colors.textSecondary, marginTop: 2 }}>
                    {selectedSkillInfo.description}
                  </div>
                )}
              </div>

              {/* User skill actions */}
              {isEditingUserSkill && (
                <>
                  {hasUnsavedChanges && (
                    <Button
                      icon={<SaveOutlined />}
                      size="small"
                      onClick={handleSaveSkill}
                      loading={savingSkill}
                      style={{
                        backgroundColor: `${theme.dracula.green}15`,
                        borderColor: `${theme.dracula.green}40`,
                        color: theme.dracula.green,
                      }}
                    >
                      Save
                    </Button>
                  )}
                  <Popconfirm
                    title="Delete this skill?"
                    onConfirm={() => handleDeleteSkill(selectedSkillName!)}
                    okText="Delete"
                    cancelText="Cancel"
                    okButtonProps={{ danger: true }}
                  >
                    <Button
                      icon={<DeleteOutlined />}
                      size="small"
                      danger
                      style={{
                        backgroundColor: `${theme.dracula.red}15`,
                        borderColor: `${theme.dracula.red}40`,
                      }}
                    >
                      Delete
                    </Button>
                  </Popconfirm>
                </>
              )}

              {/* Reset Button for built-in skills */}
              {!isEditingUserSkill && selectedSkillConfig?.isCustomized && (
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

            {/* Skill Instructions Editor */}
            <div ref={editorWrapperRef} style={{ flex: 1, padding: theme.spacing.md, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              {isLoading ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Spin tip="Loading..." />
                </div>
              ) : (
                <Input.TextArea
                  value={
                    isEditingUserSkill
                      ? pendingSkillData?.instructions || ''
                      : (selectedSkillConfig?.instructions || defaultInstructions[selectedSkillName!] || '')
                  }
                  onChange={(e) => {
                    if (isEditingUserSkill) {
                      handlePendingDataChange('instructions', e.target.value);
                    } else {
                      handleUpdateInstructions(selectedSkillName!, e.target.value);
                    }
                  }}
                  placeholder="Loading skill instructions..."
                  spellCheck={false}
                  autoSize={false}
                  style={{
                    flex: 1,
                    minHeight: 0,
                    resize: 'none',
                    fontFamily: "'Consolas', 'Monaco', 'Fira Code', monospace",
                    fontSize: 13,
                    lineHeight: 1.5,
                    backgroundColor: theme.colors.backgroundAlt,
                    color: theme.colors.text,
                    borderColor: theme.colors.border,
                    borderRadius: theme.borderRadius.md,
                  }}
                />
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
