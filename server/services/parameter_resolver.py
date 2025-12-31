"""Parameter Resolver - Template variable resolution.

Resolves {{node.field}} template variables in parameters using connected node outputs.
"""

import re
from typing import Dict, Any, List, Optional, Callable, TYPE_CHECKING

from core.logging import get_logger

if TYPE_CHECKING:
    from core.database import Database

logger = get_logger(__name__)

# Compiled regex for template matching
TEMPLATE_PATTERN = re.compile(r'\{\{([^}]+)\}\}')


class ParameterResolver:
    """Resolves template variables in node parameters."""

    def __init__(self, database: "Database", get_output_fn: Callable):
        """
        Args:
            database: Database for loading node parameters
            get_output_fn: Async function to get node output
                          Signature: async def (session_id, node_id, output_name) -> Dict
        """
        self.database = database
        self.get_output = get_output_fn

    async def resolve(
        self,
        parameters: Dict[str, Any],
        node_id: str,
        nodes: List[Dict],
        edges: List[Dict],
        session_id: str
    ) -> Dict[str, Any]:
        """Resolve all template variables in parameters."""
        # Build connected data map from upstream nodes
        connected_data = await self._gather_connected_outputs(node_id, nodes, edges, session_id)

        # Resolve templates
        return self._resolve_templates(parameters, connected_data)

    async def _gather_connected_outputs(
        self,
        node_id: str,
        nodes: List[Dict],
        edges: List[Dict],
        session_id: str
    ) -> Dict[str, Any]:
        """Gather outputs from all nodes in the workflow that have executed.

        n8n pattern: Template variables can reference ANY node's output in the workflow,
        not just directly connected nodes. This allows flexible data flow patterns like:
        - A -> B -> C where C references A's output directly
        - Parallel branches where downstream nodes reference any upstream node
        """
        connected = {}

        logger.debug(f"[ParameterResolver] Gathering outputs for node {node_id}, total nodes in workflow: {len(nodes)}")

        # Gather outputs from ALL nodes (not just directly connected)
        # This allows {{nodeName.field}} to reference any previously executed node
        for source_node in nodes:
            source_id = source_node.get('id')
            if source_id == node_id:
                continue  # Skip self

            node_type = source_node.get('type', '')
            node_key = self._get_template_key(source_node)

            # Special handling for start nodes
            if node_type == 'start':
                data = await self._get_start_node_data(source_id)
            else:
                data = await self.get_output(session_id, source_id, "output_0")

            if data:
                connected[node_key] = data
                logger.debug(f"[ParameterResolver] Found output for {node_key} (type={node_type}): keys={list(data.keys()) if isinstance(data, dict) else type(data)}")

        logger.debug(f"[ParameterResolver] Available data keys for resolution: {list(connected.keys())}")
        return connected

    async def _get_start_node_data(self, node_id: str) -> Optional[Dict]:
        """Get initial data from start node parameters."""
        import json
        params = await self.database.get_node_parameters(node_id)
        if not params or 'initialData' not in params:
            return {}

        initial_data = params.get('initialData', '{}')
        try:
            return json.loads(initial_data) if isinstance(initial_data, str) else initial_data
        except Exception:
            return {}

    def _get_template_key(self, node: Dict) -> str:
        """Get template key for a node (lowercase, no spaces).

        Priority matches frontend useDragVariable hook:
        1. node.data.label (user-defined label)
        2. node.data.displayName (from node definition)
        3. node.type (lowercased)
        4. node.id (fallback)
        """
        # Priority 1: User-defined label
        label = node.get('data', {}).get('label')
        if label:
            return re.sub(r'\s+', '', label.lower())

        # Priority 2: displayName from node definition (passed in node.data)
        display_name = node.get('data', {}).get('displayName')
        if display_name:
            return re.sub(r'\s+', '', display_name.lower())

        # Priority 3: node type
        node_type = node.get('type', '')
        if node_type:
            return node_type.lower()

        # Priority 4: node id
        return node.get('id', 'unknown').lower()

    def _resolve_templates(self, parameters: Dict[str, Any], connected_data: Dict[str, Any]) -> Dict[str, Any]:
        """Resolve {{variable}} templates in parameters recursively."""
        # Case-insensitive lookup
        data_lower = {k.lower(): v for k, v in connected_data.items()}

        # Log template resolution context
        template_params = {k: v for k, v in parameters.items() if isinstance(v, str) and '{{' in v}
        if template_params:
            logger.info(f"[ParameterResolver] Resolving templates: params_with_templates={list(template_params.keys())}, available_nodes={list(data_lower.keys())}")

        def resolve(value: Any) -> Any:
            if isinstance(value, str) and '{{' in value:
                return self._resolve_string(value, data_lower)
            if isinstance(value, dict):
                return {k: resolve(v) for k, v in value.items()}
            if isinstance(value, list):
                return [resolve(item) for item in value]
            return value

        return {k: resolve(v) for k, v in parameters.items()}

    def _resolve_string(self, value: str, data: Dict[str, Any]) -> Any:
        """Resolve templates in a string value."""
        result = value

        for match in TEMPLATE_PATTERN.finditer(value):
            full_match = match.group(0)
            path = match.group(1).split('.')
            node_name = path[0].lower()
            property_path = path[1:]

            node_data = data.get(node_name)
            resolved_value = self._navigate_path(node_data, property_path)

            logger.debug(f"[ParameterResolver] Resolving '{full_match}': node_name={node_name}, path={property_path}, found_data={node_data is not None}, resolved={resolved_value is not None}")

            if resolved_value is not None:
                # If entire value is just the template, preserve type
                if value.strip() == full_match:
                    return resolved_value
                result = result.replace(full_match, str(resolved_value))
            else:
                # Log missing resolution for debugging
                logger.debug(f"[ParameterResolver] Could not resolve '{full_match}': available keys={list(data.keys())}")
                result = result.replace(full_match, '')

        return result

    def _navigate_path(self, data: Any, path: List[str]) -> Any:
        """Navigate through nested dict using path parts."""
        current = data
        for part in path:
            if not isinstance(current, dict) or part not in current:
                return None
            current = current[part]
        return current
