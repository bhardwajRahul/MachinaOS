"""HTTP endpoint for node output schemas.

Mirrors n8n's static-asset pattern: the editor fetches
``GET /api/schemas/nodes/{node_type}.json`` on demand (no auth required,
long-cacheable). See docs-internal/schema_source_of_truth_rfc.md for
the design rationale and docs-internal/schema_source_of_truth_rfc.md
for the frontend consumer (useNodeOutputSchemaQuery).
"""

from fastapi import APIRouter, HTTPException, Response

from services.node_output_schemas import (
    get_node_output_schema,
    list_node_types_with_schema,
)

router = APIRouter(prefix="/api/schemas", tags=["schemas"])


@router.get("/nodes/{node_type}.json")
async def get_node_schema(node_type: str, response: Response):
    """Return the JSON Schema for a node type's runtime output.

    - 200 + JSON Schema: when a schema is declared.
    - 404: when no schema exists for the node type. Frontend falls back
      to real run data / empty state.

    Long cache: these schemas change only when the app ships a new
    release, so we set a 24h Cache-Control. nginx / CDN can cache too.
    """

    schema = get_node_output_schema(node_type)
    if schema is None:
        raise HTTPException(status_code=404, detail=f"No schema for node type {node_type!r}")
    response.headers["Cache-Control"] = "public, max-age=86400"
    return schema


@router.get("/nodes")
async def list_schemas():
    """List every node type that has a declared output schema. Editor
    uses this to know which types it can query without probing 404s."""

    return {"node_types": list_node_types_with_schema()}
