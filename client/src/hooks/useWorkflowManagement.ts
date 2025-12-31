import { useCallback } from 'react';
import { useAppStore } from '../store/useAppStore';

export const useWorkflowManagement = () => {
  const {
    currentWorkflow,
    hasUnsavedChanges,
    savedWorkflows,
    updateWorkflow,
    saveWorkflow,
    loadWorkflow,
    createNewWorkflow,
  } = useAppStore();

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

  const handleSelectWorkflow = useCallback((workflow: any) => {
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