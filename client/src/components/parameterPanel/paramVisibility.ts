/**
 * Pure function for evaluating `INodeProperties.displayOptions.show` rules.
 *
 * Extracted from MiddleSection.tsx for testability.  The function decides
 * whether a parameter should render in the parameter panel based on the
 * current values of OTHER parameters.
 *
 * Rules:
 *   - No `displayOptions.show` -> always visible
 *   - For each (paramName, allowed) entry in `show`:
 *       * If `allowed` is an array, the parameter is hidden unless the current
 *         value is one of the array entries.
 *       * Otherwise (scalar), the parameter is hidden unless the current value
 *         equals the scalar.
 *   - ALL conditions must hold for the parameter to be visible.
 */

import type { INodeProperties } from '../../types/INodeProperties';

export function shouldShowParameter(
  param: INodeProperties,
  allParameters: Record<string, any>,
): boolean {
  const show = param.displayOptions?.show;
  if (!show) return true;

  for (const [paramName, allowedValues] of Object.entries(show)) {
    const currentValue = allParameters[paramName];

    if (Array.isArray(allowedValues)) {
      if (!allowedValues.includes(currentValue)) {
        return false;
      }
    } else {
      if (currentValue !== allowedValues) {
        return false;
      }
    }
  }

  return true;
}
