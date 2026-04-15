"""Wave 11 — plugin contract invariants.

Enforces every :class:`BaseNode` subclass honours the declared shape
before it ships. Mirrors the 108-invariant suite in ``test_node_spec.py``
but for the class-based plugin path (11.B onwards).

These run even when no plugins exist yet (emptiness ⇒ pass). As 11.B
adds plugins, they automatically participate.
"""

from __future__ import annotations

from typing import get_type_hints

import pytest
from pydantic import BaseModel


def _all_plugin_classes():
    # Import populates the plugin-class registry at module import time.
    import nodes  # noqa: F401  (populate registry)
    from services.node_registry import registered_node_classes

    return list(registered_node_classes().values())


class TestBaseNodeDeclaration:
    """Every subclass must declare the minimum viable fields."""

    def test_non_empty_type(self):
        for cls in _all_plugin_classes():
            assert cls.type, f"{cls.__qualname__} missing required class attr `type`"

    def test_non_empty_display_name(self):
        for cls in _all_plugin_classes():
            assert cls.display_name, f"{cls.__qualname__} missing `display_name`"

    def test_non_empty_group(self):
        for cls in _all_plugin_classes():
            assert cls.group, f"{cls.__qualname__} missing `group`"

    def test_version_is_positive_int(self):
        for cls in _all_plugin_classes():
            assert isinstance(cls.version, int) and cls.version >= 1, (
                f"{cls.__qualname__} version must be a positive int"
            )


class TestParamsAndOutput:
    """Params + Output must be Pydantic models."""

    def test_params_is_basemodel(self):
        for cls in _all_plugin_classes():
            assert issubclass(cls.Params, BaseModel), (
                f"{cls.__qualname__}.Params must be a Pydantic BaseModel"
            )

    def test_output_is_basemodel(self):
        for cls in _all_plugin_classes():
            assert issubclass(cls.Output, BaseModel), (
                f"{cls.__qualname__}.Output must be a Pydantic BaseModel"
            )


class TestCredentials:
    """Every declared credential must resolve to a registered class."""

    def test_credentials_are_registered(self):
        from services.plugin.credential import CREDENTIAL_REGISTRY, Credential

        for cls in _all_plugin_classes():
            for cred in cls.credentials:
                assert issubclass(cred, Credential), (
                    f"{cls.__qualname__}.credentials must be Credential subclasses"
                )
                assert cred.id in CREDENTIAL_REGISTRY, (
                    f"{cls.__qualname__} references unregistered credential '{cred.id}'"
                )


class TestOperations:
    """At least one op; names unique; routing requires credentials."""

    def test_at_least_one_operation(self):
        from services.plugin.base import _EmptyOutput

        for cls in _all_plugin_classes():
            # Pure-display plugins (no handler) are allowed — skip those.
            if cls.Params.__name__ == "_EmptyParams" and cls.Output is _EmptyOutput:
                continue
            assert cls._operations, (
                f"{cls.__qualname__} must declare at least one @Operation"
            )

    def test_operation_names_unique(self):
        for cls in _all_plugin_classes():
            names = [spec.name for spec in cls._operations.values()]
            assert len(names) == len(set(names)), (
                f"{cls.__qualname__} has duplicate operation names: {names}"
            )

    def test_routing_requires_credentials(self):
        for cls in _all_plugin_classes():
            for spec in cls._operations.values():
                if spec.routing is not None:
                    assert cls.credentials, (
                        f"{cls.__qualname__}.{spec.name} uses routing but no "
                        f"credentials declared"
                    )


class TestScalingKnobs:
    """Temporal knobs must have sane values."""

    def test_task_queue_declared(self):
        from services.plugin.scaling import TaskQueue

        for cls in _all_plugin_classes():
            assert cls.task_queue in TaskQueue.ALL, (
                f"{cls.__qualname__}.task_queue={cls.task_queue!r} "
                f"not in TaskQueue.ALL"
            )

    def test_retry_policy_type(self):
        from services.plugin.scaling import RetryPolicy

        for cls in _all_plugin_classes():
            assert isinstance(cls.retry_policy, RetryPolicy), (
                f"{cls.__qualname__}.retry_policy must be a RetryPolicy"
            )


class TestToolSchemaGeneration:
    """ToolNode.Params must produce LLM-compatible JSON schema."""

    def test_tool_schema_has_no_refs(self):
        from services.plugin.tool import ToolNode

        for cls in _all_plugin_classes():
            if not issubclass(cls, ToolNode):
                continue
            schema = cls.as_tool_schema()
            params = schema["parameters"]
            assert "$defs" not in params, (
                f"{cls.__qualname__} tool schema contains $defs — LLM "
                "function-calling rejects $ref"
            )
            assert "definitions" not in params
            assert schema.get("name") == cls.type


class TestToolSchemaFastPath:
    """Wave 11.D.12: every plugin node usable as an AI tool must resolve
    via the plugin fast-path in :meth:`AIService._get_tool_schema`.
    Legacy per-type hardcoded branches become dead code once this test
    passes — scheduled for deletion in 11.D.13.
    """

    def test_fast_path_covers_every_plugin_tool(self):
        from services.node_registry import get_node_class
        from services.plugin.tool import ToolNode

        for cls in _all_plugin_classes():
            is_tool = issubclass(cls, ToolNode) or getattr(cls, "usable_as_tool", False)
            if not is_tool:
                continue
            resolved = get_node_class(cls.type)
            assert resolved is cls, (
                f"{cls.__qualname__}: fast-path lookup by type '{cls.type}' "
                f"returned {resolved}, expected {cls}"
            )
            assert hasattr(resolved, "Params"), (
                f"{cls.__qualname__} has no Params — fast-path would miss it"
            )


class TestTriggerRegistryAutoPopulate:
    """Wave 11.D.11: every event-mode TriggerNode plugin must register
    itself into event_waiter.TRIGGER_REGISTRY + FILTER_BUILDERS
    (hardcoded entries still win so this is a superset check)."""

    def test_every_event_trigger_has_event_type(self):
        from services.plugin.trigger import TriggerNode

        for cls in _all_plugin_classes():
            if not issubclass(cls, TriggerNode):
                continue
            if getattr(cls, "mode", "event") != "event":
                continue
            assert cls.event_type, (
                f"{cls.__qualname__} (TriggerNode, mode=event) is missing "
                "event_type — event_waiter won't auto-populate for it"
            )

    def test_event_triggers_populate_registry(self):
        from services import event_waiter
        from services.plugin.trigger import TriggerNode

        for cls in _all_plugin_classes():
            if not issubclass(cls, TriggerNode):
                continue
            if getattr(cls, "mode", "event") != "event" or not cls.event_type:
                continue
            cfg = event_waiter.get_trigger_config(cls.type)
            assert cfg is not None, (
                f"{cls.__qualname__}: get_trigger_config('{cls.type}') returned None"
            )
            assert cfg.event_type == cls.event_type
