/**
 * Workflow Export/Import Utilities
 * Handles exporting workflows to JSON files and importing from JSON
 */

import { WorkflowData } from '../store/useAppStore';
import { validateWorkflow, serializeWorkflow, deserializeWorkflow } from '../schemas/workflowSchema';

/**
 * Export workflow to JSON file
 */
export function exportWorkflowToFile(workflow: WorkflowData): void {
  const validation = validateWorkflow(workflow);

  if (!validation.valid) {
    console.error('Workflow validation errors:', validation.errors);
    throw new Error(`Cannot export invalid workflow: ${validation.errors.join(', ')}`);
  }

  const workflowJSON = {
    ...workflow,
    createdAt: workflow.createdAt.toISOString(),
    lastModified: workflow.lastModified.toISOString(),
    version: '1.0.0'
  };

  const jsonString = serializeWorkflow(workflowJSON);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `${workflow.name || 'workflow'}_${workflow.id}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Import workflow from JSON file
 */
export function importWorkflowFromFile(file: File): Promise<WorkflowData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const jsonString = event.target?.result as string;
        const workflow = deserializeWorkflow(jsonString);

        const validation = validateWorkflow(workflow);
        if (!validation.valid) {
          reject(new Error(`Invalid workflow JSON: ${validation.errors.join(', ')}`));
          return;
        }

        resolve(workflow);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsText(file);
  });
}

/**
 * Export workflow to JSON string
 */
export function exportWorkflowToJSON(workflow: WorkflowData): string {
  const validation = validateWorkflow(workflow);

  if (!validation.valid) {
    throw new Error(`Cannot export invalid workflow: ${validation.errors.join(', ')}`);
  }

  const workflowJSON = {
    ...workflow,
    createdAt: workflow.createdAt.toISOString(),
    lastModified: workflow.lastModified.toISOString(),
    version: '1.0.0'
  };

  return serializeWorkflow(workflowJSON);
}

/**
 * Import workflow from JSON string
 */
export function importWorkflowFromJSON(jsonString: string): WorkflowData {
  const workflow = deserializeWorkflow(jsonString);

  const validation = validateWorkflow(workflow);
  if (!validation.valid) {
    throw new Error(`Invalid workflow JSON: ${validation.errors.join(', ')}`);
  }

  return workflow;
}

/**
 * Copy workflow to clipboard as JSON
 */
export async function copyWorkflowToClipboard(workflow: WorkflowData): Promise<void> {
  const jsonString = exportWorkflowToJSON(workflow);
  await navigator.clipboard.writeText(jsonString);
}

/**
 * Paste workflow from clipboard
 */
export async function pasteWorkflowFromClipboard(): Promise<WorkflowData> {
  const jsonString = await navigator.clipboard.readText();
  return importWorkflowFromJSON(jsonString);
}
