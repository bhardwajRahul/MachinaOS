import { ExecutionResult } from '../executionService';

// AI Agent execution result (simplified)
export interface AIAgentExecutionResult extends ExecutionResult {
  aiResponse?: string;
  toolCalls?: any[];
  iterations?: number;
  tokens?: {
    prompt: number;
    completion: number;
    total: number;
  };
}

export class AIAgentExecutionService {
  /**
   * Basic validation for UI feedback - backend handles full validation
   */
  static validateConfiguration(nodeData: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Basic required field checks for immediate UI feedback
    if (!nodeData.prompt || nodeData.prompt.trim() === '') {
      errors.push('Prompt is required');
    }

    // Backend handles all complex validation, API keys, etc.
    return {
      valid: errors.length === 0,
      errors
    };
  }
}

export default AIAgentExecutionService;