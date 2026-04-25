"""OpenTelemetry tracing bootstrap.

Single initialization point for the OTel TracerProvider. Modules that
want to emit spans do::

    from opentelemetry import trace
    tracer = trace.get_tracer(__name__)

    async def something():
        with tracer.start_as_current_span("namespace.operation"):
            ...

Spans are exported via ``ConsoleSpanExporter`` so cold-start
benchmarking is grep-able from the same terminal that runs the dev
server::

    pnpm run dev 2>&1 | grep '"name":'

In production, swap ``ConsoleSpanExporter`` for an OTLP exporter
pointed at a collector (Jaeger / Tempo / Honeycomb / etc.) — purely
config, no code change at the call sites.

This file owns the only place in the codebase where the OTel SDK is
configured. Every other module uses ``trace.get_tracer(__name__)``
which is the standard library API; no project-specific abstraction.
"""

from __future__ import annotations

from opentelemetry import trace
from opentelemetry.sdk.resources import SERVICE_NAME, Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import (
    BatchSpanProcessor,
    ConsoleSpanExporter,
)


_INITIALIZED = False


def init_tracing(service_name: str = "machinaos-backend") -> None:
    """Configure the global TracerProvider.

    Idempotent — safe to call multiple times. Subsequent calls are
    no-ops so tests / reloads do not accumulate processors.
    """
    global _INITIALIZED
    if _INITIALIZED:
        return

    provider = TracerProvider(
        resource=Resource.create({SERVICE_NAME: service_name})
    )
    # ConsoleSpanExporter writes one JSON document per span to stdout —
    # ideal for dev/benchmark mode. Span fields include ``name``,
    # ``start_time``, ``end_time``, ``attributes``, ``status``.
    provider.add_span_processor(BatchSpanProcessor(ConsoleSpanExporter()))
    trace.set_tracer_provider(provider)
    _INITIALIZED = True
