import { useCallback } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useWorkflowsQuery, type SavedWorkflow } from './useWorkflowsQuery';

export const useWorkflowManagement = () => {
  const {
    currentWorkflow,
    hasUnsavedChanges,
    updateWorkflow,
    saveWorkflow,
    loadWorkflow,
    createNewWorkflow,
  } = useAppStore();

  const { data: savedWorkflows = [] } = useWorkflowsQuery();

  const handleWorkflowNameChange = useCallback((name: string) => {
    updateWorkflow({ name });
  }, [updateWorkflow]);

  const handleSave = useCallback(() => {
    saveWorkflow();
  }, [saveWorkflow]);

  const handleNew = useCallback(() => {
    createNewWorkflow();
  }, [createNewWorkflow]);

  const handleOpen = useCallback(() => {
    // Workflow selection is handled by sidebar
  }, []);

  const handleSelectWorkflow = useCallback((workflow: SavedWorkflow) => {
    loadWorkflow(workflow.id);
  }, [loadWorkflow]);


  return {
    currentWorkflow,
    hasUnsavedChanges,
    savedWorkflows,
    handleWorkflowNameChange,
    handleSave,
    handleNew,
    handleOpen,
    handleSelectWorkflow,
  };
};
