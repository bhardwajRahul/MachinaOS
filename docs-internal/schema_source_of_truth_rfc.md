# Schema source of truth — RFC

**Status:** ✅ **implemented** · **Owner:** frontend + backend platform · **Date:** 2026-04-14 · **Landed across:** commits `cd252c1` → `4a4a439` (8 commits on `feature/credentials-scaling-v2`)

## Landed outcome

- Backend registry seeded with **98 Pydantic models** in [server/services/node_output_schemas.py](../server/services/node_output_schemas.py) covering every node type the deleted `sampleSchemas` map covered, plus all 18 specialized agents and 9 chat models.
- `GET /api/schemas/nodes/{node_type}.json` serves static JSON Schema (Cache-Control `public, max-age=86400`). 404 for unknown types.
- `get_node_output_schema` WebSocket handler for authenticated editor fetches.
- [InputSection.tsx](../client/src/components/parameterPanel/InputSection.tsx) consumes schemas lazy via `queryClient.fetchQuery(['nodeOutputSchema', nodeType])`, in-memory cache only. **1,673 → 972 LOC** (−701). sampleSchemas map, 20 `isXxxNode` detection constants, and 60-line pattern-match chain all gone.
- `outputSchema` field removed from `INodeTypeDescription` — the frontend type no longer has any shape-describing surface for runtime output.
- Adding a new node type's output shape: one Pydantic model in `node_output_schemas.py`. Zero frontend change.

## Problem

The editor's Input panel (`client/src/components/parameterPanel/InputSection.tsx`) needs to show the runtime output shape of every connected source node so users can drag variables into downstream parameters. Today there are two places this shape is declared:

1. A 350-line `sampleSchemas` map inline in `InputSection.tsx` (59 entries).
2. As-of Wave 3 Phase 1 Batch 1 (commit `f1b2813`), a new `outputSchema` field on each `INodeTypeDescription` that the frontend consults before the legacy map.

Both are **frontend duplications of what the backend already owns** — the handler's return type (Pydantic models in `server/services/handlers/*`). Every node addition requires a frontend edit to keep schemas in sync.

## How this scales to 1000+ nodes elsewhere

Raw-GitHub-API research against three schema-driven platforms (n8n ~500 nodes, Activepieces ~400 pieces, Nango 100+ integrations):

**n8n** — the canonical comparison point, React Flow / Vue inspector:
- Node type descriptions come from the backend via `GET /node-types` on boot (`packages/frontend/editor-ui/src/app/stores/nodeTypes.store.ts`).
- The Input panel (`VirtualSchema.vue`) pulls the output shape from two sources in order of preference:
  1. Actual execution data — `getSchemaForExecutionData(props.data)`.
  2. A JSON Schema preview fetched lazy per-node via `GET /schemas/{nodeType}/{version}/{resource?}/{operation?}.json` (`schemaPreview.api.ts`). These are **static JSON files served alongside the backend**, `withCredentials: false`, keyed `${nodeType}_${version}_${resource}_${operation}` in a `Map<string, Result<JSONSchema7, Error>>` in-memory cache.
  3. Empty state when neither is available.

**Activepieces** (`packages/pieces/framework/src/lib/*`):
- Piece-authors declare Actions in TypeScript inside the piece's backend package. **Actions have no `outputSchema` field at all.** Triggers carry `sampleData: unknown` — a free-form example value the UI renders in the variable picker before first run.
- The backend emits two payloads to the editor: `PieceMetadataSummary` (icon + counts + suggested) for catalog browsing, and the full `PieceMetadata` (actions + triggers records) on select.

**Nango** (`packages/types/lib/nangoYaml/index.ts`):
- YAML config declares `input: ModelName` / `output: ModelName[]` per sync or action. Model definitions in the same YAML are codegen'd into TypeScript types shipped to both backend and frontend.

**Finding:** zero of these platforms keep node-shape declarations on the frontend. n8n explicitly serves per-node JSON Schema files from the backend; Activepieces skips declared schemas entirely in favor of real run data.

## Decision

Adopt n8n's layered pattern.

**Schema source of truth:** backend only. Pydantic models colocated with node handlers.

**Frontend rendering order** (three-tier, mirrors `VirtualSchema.vue`):
1. Real execution data from the most recent run (already wired at [`InputSection.tsx:164-174`](../client/src/components/parameterPanel/InputSection.tsx)).
2. `GET /api/schemas/nodes/{nodeType}.json` — JSON Schema served lazy from the backend, cached in-memory per node type.
3. Empty state / `{ data: 'any' }` fallback.

**What the frontend keeps:**
- `INodeTypeDescription` stays a **UI-only** description: `displayName`, `icon`, `group`, `inputs`, `outputs`, `properties`, `defaults`, `uiHints`, `credentials`. No data schemas.
- `uiHints` (Wave 2 Phase 1) is genuinely UI-owned (panel visibility, editor variants, selector dispatch) and stays.

**What leaves the frontend:**
- `outputSchema` field on `INodeTypeDescription` (added by commit `f1b2813`) — deleted.
- `sampleSchemas` map in `InputSection.tsx` — deleted once the backend endpoint has coverage for the node types currently listed there.

## Backend contract

```
GET /api/schemas/nodes/{node_type}.json
  200 → application/json: JSON Schema 7 describing the node's output shape
  404 → node has no declared schema (frontend falls back to run data / empty)
  headers: Cache-Control: public, max-age=86400 (or similar)
```

WebSocket parallel:
```
request:  { type: "get_node_output_schema", node_type: "whatsappReceive" }
response: { schema: JSONSchema7 | null }
```

Schema generation: each handler's existing Pydantic response model (or a new minimal `NodeOutputSchema` Pydantic model colocated with the handler) emits JSON Schema via `.model_json_schema()`. Registry at `server/services/node_output_schemas.py`: `NODE_OUTPUT_SCHEMAS: dict[str, type[BaseModel]]` mapping node type → model class. Missing entries return 404.

## Frontend changes

1. New `useNodeOutputSchemaQuery(nodeType)` inline at top of `InputSection.tsx` (one consumer — inline per the Wave 2/3 colocation rule):
   ```ts
   function useNodeOutputSchemaQuery(nodeType: string | null) {
     return useQuery<Record<string, any> | null>({
       queryKey: ['nodeOutputSchema', nodeType],
       queryFn: () => nodeType
         ? sendRequest('get_node_output_schema', { node_type: nodeType })
             .then(r => r?.schema ?? null)
         : Promise.resolve(null),
       staleTime: Infinity,
       enabled: !!nodeType,
     });
   }
   ```

2. `InputSection` dispatch becomes three-tier:
   ```ts
   if (executionData?.length) outputSchema = executionData[0][0].json;
   else if (backendSchema)    outputSchema = backendSchema;
   else                       outputSchema = { data: 'any' };
   ```
   Delete the `sampleSchemas` map + pattern-match else-if chain + all `isXxx` constant flags.

3. Revert commit `f1b2813` (frontend `outputSchema` annotations). Remove the `outputSchema` field from `INodeTypeDescription`.

## Migration order

1. Write this RFC. (this file)
2. Frontend: add the `useNodeOutputSchemaQuery` hook + three-tier dispatch. **Keep** the legacy `sampleSchemas` map as a temporary final fallback below the backend call so nothing breaks before the backend endpoint exists. The `nodeDef.outputSchema` branch goes away in this commit (revert + remove the type field).
3. Backend: implement `/api/schemas/nodes/{node_type}.json` + `get_node_output_schema` WS handler. Seed the registry from existing Pydantic response models (start with the high-traffic nodes: `chatTrigger`, `webhookTrigger`, `whatsappReceive`, `aiAgent`/`chatAgent` family, `httpRequest`, code executors, Google Workspace).
4. Frontend: once the backend has coverage for every type in the legacy `sampleSchemas` map, **delete the map**. Verify via manual smoke of the 20 node categories.

## What this unblocks

Phase 6 (`ParameterRenderer` → DIY widget registry) was blocked on the backend emitting `NodeSpec { jsonSchema, uiSchema, _uiHints? }`. The endpoint defined here is the `jsonSchema` slice of that same `NodeSpec` — Phase 6 extends it with `uiSchema` + `_uiHints`. Phase 1-REVISED is therefore the on-ramp to Phase 6, not a detour.

## Non-goals

- Build-time codegen of TypeScript types from the backend schemas (Nango's pattern) — deferred. The frontend reads schemas as plain JSON; typed inference on top would be nice-to-have but isn't load-bearing.
- Versioning of schemas per node-type version — deferred. All current node types are v1; add `{version}` to the URL path the first time we bump.

## References

- [n8n `schemaPreview.api.ts`](https://github.com/n8n-io/n8n/blob/master/packages/frontend/editor-ui/src/features/ndv/runData/schemaPreview.api.ts)
- [n8n `VirtualSchema.vue`](https://github.com/n8n-io/n8n/blob/master/packages/frontend/editor-ui/src/features/ndv/runData/components/VirtualSchema.vue)
- [n8n `nodeTypes.store.ts`](https://github.com/n8n-io/n8n/blob/master/packages/frontend/editor-ui/src/app/stores/nodeTypes.store.ts)
- [Activepieces `piece-metadata.ts`](https://github.com/activepieces/activepieces/blob/main/packages/pieces/framework/src/lib/piece-metadata.ts)
- [Activepieces `action.ts`](https://github.com/activepieces/activepieces/blob/main/packages/pieces/framework/src/lib/action/action.ts)
- [Nango `nangoYaml/index.ts`](https://github.com/NangoHQ/nango/blob/master/packages/types/lib/nangoYaml/index.ts)
