/**
 * Adapter: backend NodeSpec (wire format) → legacy INodeTypeDescription.
 *
 * Wave 6 Phase 2 bridge. Consumers still read INodeTypeDescription today;
 * this adapter lets us switch the source from frontend-owned
 * `nodeDefinitions/*.ts` to the server-emitted NodeSpec without a big-bang
 * refactor of every consumer. The adapter is intentionally thin — it
 * translates JSON-Schema-shaped input properties into the
 * INodeProperties[] array the parameter panel expects.
 *
 * Phase 6 (capstone) inlines this adapter once all consumers read NodeSpec
 * directly; for now it's the seam that makes Phase 3's per-file deletions
 * safe.
 */

import type {
  INodeProperties,
  INodeTypeDescription,
  NodeConnectionType,
} from '../types/INodeProperties';

/** Wire shape emitted by GET /api/schemas/nodes/{type}/spec.json. */
export interface NodeSpec {
  type: string;
  displayName: string;
  icon: string;
  group: string[];
  description?: string;
  subtitle?: string;
  version: number;
  /** JSON Schema 7 document describing input parameters (Pydantic-derived). */
  inputs?: JsonSchema;
  /** JSON Schema 7 document describing runtime output (Wave 3 contract). */
  outputs?: JsonSchema;
  credentials?: string[];
  uiHints?: Record<string, unknown>;
}

interface JsonSchema {
  type?: string;
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
  additionalProperties?: boolean | JsonSchema;
  title?: string;
  description?: string;
}

interface JsonSchemaProperty {
  type?: string | string[];
  title?: string;
  description?: string;
  default?: unknown;
  enum?: unknown[];
  minimum?: number;
  maximum?: number;
  format?: string;
  anyOf?: JsonSchemaProperty[];
  items?: JsonSchemaProperty;
  additionalProperties?: boolean | JsonSchemaProperty;
  /** Editor hints lifted from Pydantic Field(json_schema_extra=...). */
  uiHints?: Record<string, unknown>;
}

type InodeType = INodeProperties['type'];

/**
 * Convert a JSON Schema property → INodeProperties.type value expected
 * by the parameter renderer. Prefers `enum` → `options`, then falls back
 * to the JSON Schema primitive type. Unknown shapes map to `string` so
 * the user sees an editable field rather than a blank slot.
 */
function mapPropertyType(prop: JsonSchemaProperty): InodeType {
  if (prop.enum && prop.enum.length > 0) return 'options';
  if (prop.uiHints?.editor === 'code') return 'code';
  if (prop.uiHints?.editor === 'json') return 'json';
  // anyOf([T, null]) is the Pydantic Optional[T] pattern — take the non-null branch.
  if (prop.anyOf) {
    const nonNull = prop.anyOf.find(b => b.type && b.type !== 'null');
    if (nonNull) return mapPropertyType(nonNull);
  }
  const t = Array.isArray(prop.type) ? prop.type[0] : prop.type;
  switch (t) {
    case 'boolean':
      return 'boolean';
    case 'integer':
    case 'number':
      return 'number';
    case 'array':
      return 'collection';
    case 'object':
      return 'fixedCollection';
    case 'string':
    default:
      return 'string';
  }
}

function toInodeProperty(name: string, prop: JsonSchemaProperty): INodeProperties {
  const type = mapPropertyType(prop);
  const options = prop.enum?.map(v => ({ name: String(v), value: v as string | number | boolean }));
  const out: INodeProperties = {
    displayName: prop.title || name,
    name,
    type,
    default: prop.default,
    description: prop.description,
    options,
  };
  if (prop.minimum !== undefined || prop.maximum !== undefined) {
    out.typeOptions = {
      ...(prop.minimum !== undefined ? { minValue: prop.minimum } : {}),
      ...(prop.maximum !== undefined ? { maxValue: prop.maximum } : {}),
    };
  }
  // Lift Pydantic json_schema_extra hints (displayOptions, loadOptionsMethod, etc.)
  const hints = prop.uiHints;
  if (hints) {
    if (hints.displayOptions) out.displayOptions = hints.displayOptions as INodeProperties['displayOptions'];
    if (hints.loadOptionsMethod) {
      out.typeOptions = {
        ...out.typeOptions,
        loadOptionsMethod: hints.loadOptionsMethod as string,
        ...(hints.loadOptionsDependsOn ? { loadOptionsDependsOn: hints.loadOptionsDependsOn as string[] } : {}),
      };
    }
  }
  return out;
}

/**
 * Derive the INodeTypeDescription.inputs/outputs handle shape. When the
 * backend NodeSpec doesn't yet carry handle configs (Phase 1/2 stub),
 * default to a single 'main' handle — matches the legacy nodeDefinitions
 * default and keeps React Flow happy.
 */
function defaultHandles(): NodeConnectionType[] {
  return ['main' as NodeConnectionType];
}

/**
 * Top-level conversion. Adapter is pure — no side effects, no throws.
 * Missing fields become sensible defaults so the parameter panel always
 * has something to render.
 */
export function nodeSpecToDescription(spec: NodeSpec): INodeTypeDescription {
  const propsObject = spec.inputs?.properties ?? {};
  const properties: INodeProperties[] = Object.entries(propsObject).map(
    ([name, prop]) => toInodeProperty(name, prop),
  );

  return {
    displayName: spec.displayName,
    name: spec.type,
    icon: spec.icon,
    group: spec.group ?? [],
    version: spec.version ?? 1,
    subtitle: spec.subtitle,
    description: spec.description ?? '',
    defaults: {
      name: spec.displayName,
    },
    inputs: defaultHandles(),
    outputs: defaultHandles(),
    properties,
    credentials: spec.credentials?.map(name => ({ name })),
    uiHints: spec.uiHints as INodeTypeDescription['uiHints'],
  };
}
