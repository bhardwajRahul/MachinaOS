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
import { Loader2, Info, Plus, Trash2, Save, X, RotateCcw, Search, Folder, Inbox } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge as DSBadge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { Button } from '@/components/ui/button';
import { Alert as DSAlert, AlertDescription } from '@/components/ui/alert';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppTheme } from '../../hooks/useAppTheme';
import { useWebSocket } from '../../contexts/WebSocketContext';
import { skillNodes, SKILL_NODE_TYPES } from '../../nodeDefinitions/skillNodes';
import { DUCKDUCKGO_ICON, BRAVE_SEARCH_ICON, SERPER_ICON, PERPLEXITY_ICON } from '../../assets/icons/search';

// Override icons for skills that have branded SVGs
const SKILL_ICON_OVERRIDES: Record<string, string> = {
  'duckduckgo-search-skill': DUCKDUCKGO_ICON,
  'brave-search-skill': BRAVE_SEARCH_ICON,
  'serper-search-skill': SERPER_ICON,
  'perplexity-search-skill': PERPLEXITY_ICON,
};

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

  // User skills from database — TanStack Query owns the cache + refetch
  // orchestration; save/delete mutations invalidate this key so the list
  // re-syncs without manual fetchUserSkills() calls scattered through the
  // handlers. Inline hook because there's exactly one consumer (here).
  const queryClient = useQueryClient();
  const userSkillsQuery = useQuery<UserSkill[], Error>({
    queryKey: ['userSkills'],
    queryFn: async () => {
      const response = await sendRequest<{ skills: UserSkill[]; count: number }>(
        'get_user_skills',
        { active_only: false },
      );
      return response?.skills ?? [];
    },
    staleTime: 60_000,
  });
  const userSkills = userSkillsQuery.data ?? [];
  const invalidateUserSkills = useCallback(
    () => queryClient.invalidateQueries({ queryKey: ['userSkills'] }),
    [queryClient],
  );

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

  // (User skills now come from userSkillsQuery above. Save / delete flows
  // below call invalidateUserSkills() to trigger a refetch.)

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
              icon: defaults.icon || SKILL_ICON_OVERRIDES[s.name] || s.metadata?.icon || '',
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
      toast.error('Display name is required');
      return;
    }
    if (!pendingSkillData.instructions.trim()) {
      toast.error('Instructions are required');
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
        toast.error('Invalid skill ID. Use lowercase letters, numbers, and hyphens only.');
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
        toast.success(isCreatingNew ? 'Skill created' : 'Skill saved');
        await invalidateUserSkills();

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
        toast.error(result.error || 'Failed to save skill');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to save skill');
    } finally {
      setSavingSkill(false);
    }
  }, [pendingSkillData, isCreatingNew, skillFolder, sendRequest, invalidateUserSkills, skillsConfig, onConfigChange]);

  // Delete user skill
  const handleDeleteSkill = useCallback(async (skillName: string) => {
    try {
      const result = await sendRequest<{ success: boolean; error?: string }>('delete_user_skill', { name: skillName });
      if (result.success) {
        toast.success('Skill deleted');
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
        await invalidateUserSkills();
      } else {
        toast.error(result.error || 'Failed to delete skill');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete skill');
    }
  }, [sendRequest, invalidateUserSkills, skillsConfig, onConfigChange, selectedSkillName, nodeId, skillFolder]);

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
            <DSBadge
              style={{ backgroundColor: theme.dracula.purple, color: '#fff' }}
              className="h-5 min-w-5 justify-center rounded-full px-1.5"
            >
              {enabledCount}
            </DSBadge>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon-sm"
                    variant="outline"
                    onClick={handleCreateSkill}
                    disabled={isCreatingNew}
                    style={{
                      backgroundColor: `${theme.dracula.green}20`,
                      borderColor: theme.dracula.green,
                      color: theme.dracula.green,
                    }}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Create new skill</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        {/* Search */}
        <div className="border-b border-border p-2">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search skills..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 pl-8 pr-8"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Skill Folder Dropdown */}
        <div className="shrink-0 border-b border-border p-2">
          <Select
            value={skillFolder || 'assistant'}
            onValueChange={(value) => {
              onSkillFolderChange?.(value);
              setSelectedSkillName(null);
            }}
            disabled={!foldersLoaded}
          >
            <SelectTrigger className="w-full">
              <div className="flex items-center gap-2">
                <Folder className="h-4 w-4 text-muted-foreground" />
                <SelectValue placeholder="Choose folder" />
              </div>
            </SelectTrigger>
            <SelectContent>
              {availableFolders.map((f) => (
                <SelectItem key={f.name} value={f.name}>
                  {f.name} ({f.skill_count})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Skills List */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {folderLoading ? (
            <div className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Scanning folder...
            </div>
          ) : filteredSkills.length === 0 ? (
            <div className="mt-6 flex flex-col items-center gap-2 p-6 text-center text-sm text-muted-foreground">
              <Inbox className="h-10 w-10 opacity-50" />
              <p>{skillFolder ? `No skills found in skills/${skillFolder}/` : 'No skills found'}</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredSkills.map((skill) => {
                const config = skillsConfig[skill.skillName];
                const isSelected = selectedSkillName === skill.skillName && !isCreatingNew;
                const isEnabled = config?.enabled || false;
                const isCustomized = config?.isCustomized || false;

                return (
                  <div
                    key={skill.skillName}
                    onClick={() => {
                      if (isCreatingNew) {
                        if (hasUnsavedChanges) {
                          if (!confirm('Discard unsaved changes?')) return;
                        }
                        setIsCreatingNew(false);
                      }
                      setSelectedSkillName(skill.skillName);
                    }}
                    className="cursor-pointer border-l-[3px] px-3 py-2 transition-colors"
                    style={{
                      backgroundColor: isSelected ? `${skill.color}15` : 'transparent',
                      borderLeftColor: isSelected ? skill.color : 'transparent',
                    }}
                  >
                    <div className="flex w-full items-center gap-2">
                      <Checkbox
                        checked={isEnabled}
                        onCheckedChange={(checked) => {
                          handleToggleSkill(skill.skillName, checked === true);
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                      {renderSkillIcon(skill.icon || '', 16)}
                      <span
                        className="flex-1 overflow-hidden text-sm whitespace-nowrap text-ellipsis"
                        style={{
                          fontWeight: isSelected ? theme.fontWeight.semibold : theme.fontWeight.medium,
                          color: isEnabled ? theme.colors.text : theme.colors.textSecondary,
                        }}
                      >
                        {skill.displayName}
                      </span>
                      {isCustomized && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div
                                className="h-2 w-2 shrink-0 rounded-full"
                                style={{ backgroundColor: theme.dracula.orange }}
                              />
                            </TooltipTrigger>
                            <TooltipContent>Customized</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      {skill.isUserSkill && (
                        <DSBadge
                          className="h-4 px-1 text-[10px]"
                          style={{
                            backgroundColor: `${theme.dracula.cyan}20`,
                            color: theme.dracula.cyan,
                          }}
                        >
                          Custom
                        </DSBadge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
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
                {pendingSkillData.icon ? renderSkillIcon(pendingSkillData.icon, 20) : <Plus className="h-5 w-5" style={{ color: pendingSkillData.color }} />}
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
                size="sm"
                variant="outline"
                onClick={handleCancelCreate}
                style={{
                  backgroundColor: `${theme.dracula.red}15`,
                  borderColor: `${theme.dracula.red}40`,
                  color: theme.dracula.red,
                }}
              >
                <X className="h-3.5 w-3.5" />
                Cancel
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleSaveSkill}
                disabled={savingSkill}
                style={{
                  backgroundColor: `${theme.dracula.green}15`,
                  borderColor: `${theme.dracula.green}40`,
                  color: theme.dracula.green,
                }}
              >
                {savingSkill ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
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
                <Textarea
                  value={pendingSkillData.instructions}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handlePendingDataChange('instructions', e.target.value)}
                  placeholder="# Skill Instructions..."
                  spellCheck={false}
                  className="flex-1 min-h-0 resize-none font-mono text-[13px] leading-[1.5]"
                  style={{
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
                      <DSBadge
                        className="h-4 text-xs"
                        style={{
                          backgroundColor: `${theme.dracula.orange}20`,
                          color: theme.dracula.orange,
                        }}
                      >
                        Customized
                      </DSBadge>
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
                      size="sm"
                      variant="outline"
                      onClick={handleSaveSkill}
                      disabled={savingSkill}
                      style={{
                        backgroundColor: `${theme.dracula.green}15`,
                        borderColor: `${theme.dracula.green}40`,
                        color: theme.dracula.green,
                      }}
                    >
                      {savingSkill ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                      Save
                    </Button>
                  )}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        style={{
                          backgroundColor: `${theme.dracula.red}15`,
                          borderColor: `${theme.dracula.red}40`,
                          color: theme.dracula.red,
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete this skill?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. The skill and any custom
                          instructions will be permanently removed.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDeleteSkill(selectedSkillName!)}
                          className="bg-destructive text-white hover:bg-destructive/90"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              )}

              {/* Reset Button for built-in skills */}
              {!isEditingUserSkill && selectedSkillConfig?.isCustomized && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleResetToDefault(selectedSkillName!)}
                  disabled={isLoading}
                  style={{
                    backgroundColor: `${theme.dracula.orange}15`,
                    borderColor: `${theme.dracula.orange}40`,
                    color: theme.dracula.orange,
                  }}
                >
                  {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                  Reset
                </Button>
              )}
            </div>

            {/* Skill Instructions Editor */}
            <div ref={editorWrapperRef} style={{ flex: 1, padding: theme.spacing.md, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              {isLoading ? (
                <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading...
                </div>
              ) : (
                <Textarea
                  value={
                    isEditingUserSkill
                      ? pendingSkillData?.instructions || ''
                      : (selectedSkillConfig?.instructions || defaultInstructions[selectedSkillName!] || '')
                  }
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                    if (isEditingUserSkill) {
                      handlePendingDataChange('instructions', e.target.value);
                    } else {
                      handleUpdateInstructions(selectedSkillName!, e.target.value);
                    }
                  }}
                  placeholder="Loading skill instructions..."
                  spellCheck={false}
                  className="flex-1 min-h-0 resize-none font-mono text-[13px] leading-[1.5]"
                  style={{
                    backgroundColor: theme.colors.backgroundAlt,
                    color: theme.colors.text,
                    borderColor: theme.colors.border,
                    borderRadius: theme.borderRadius.md,
                  }}
                />
              )}

              {/* Enable hint */}
              {!selectedSkillConfig?.enabled && (
                <DSAlert variant="info" className="mt-3">
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    Enable this skill to include it when running the AI Agent.
                  </AlertDescription>
                </DSAlert>
              )}
            </div>
          </>
        ) : (
          <div className="m-auto flex flex-col items-center gap-2 p-6 text-center text-sm text-muted-foreground">
            <Inbox className="h-10 w-10 opacity-50" />
            <p>Select a skill to view instructions</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MasterSkillEditor;
