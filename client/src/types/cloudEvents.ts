/**
 * CloudEvents v1.0 envelope — mirrors the backend Pydantic `WorkflowEvent`
 * (`server/services/events/envelope.py`) so the FE can statically type
 * payloads broadcast over the WebSocket without falling back to `any`.
 *
 * Spec: https://github.com/cloudevents/spec/blob/v1.0.2/cloudevents/spec.md
 *
 * Wire shape on the WebSocket today (preserved end-to-end across the
 * PartySocket / TanStack-Query swap):
 *
 *     {
 *       "type": "credential_catalogue_updated",  // legacy outer routing key
 *       "data": {
 *         "specversion": "1.0",
 *         "id": "<uuid>",
 *         "source": "machinaos://services/credentials",
 *         "type": "credential.api_key.saved",   // CloudEvents `type`
 *         "time": "2026-05-06T12:34:56.789Z",
 *         "subject": "openai",
 *         "datacontenttype": "application/json",
 *         "data": { "provider": "openai", ... }
 *       }
 *     }
 *
 * Future Wave 12 sources (`stripe.*`, `telegram.*`, `task.*`) will use the
 * same envelope. The `matchesType` helper provides server-parity glob
 * dispatch (mirrors `WorkflowEvent.matches_type` in envelope.py).
 *
 * Pytest invariant `server/tests/test_credential_broadcasts.py` locks the
 * backend shape; the FE vitest counterpart locks this interface.
 */

export interface WorkflowEvent<TData = unknown> {
  // CloudEvents v1.0 required fields (ordered to match envelope.py).
  specversion: '1.0';
  id: string;
  source: string;
  type: string;
  /**
   * ISO 8601 string. The backend serialises `datetime` via Pydantic's
   * `model_dump(mode="json")` which produces RFC 3339 UTC timestamps.
   */
  time: string;
  subject?: string;
  datacontenttype?: string;
  dataschema?: string;
  data: TData;

  // CloudEvents extension attributes used by MachinaOs.
  // `model_config = ConfigDict(extra="allow")` on the Pydantic side means
  // additional fields may appear and should be tolerated; cast through
  // `WorkflowEvent<T> & {extra?: unknown}` if you need to read them.
  workflow_id?: string | null;
  trigger_node_id?: string | null;
  correlation_id?: string | null;
}

/**
 * Glob-style match on the CloudEvents `type` field.
 *
 * Mirrors `WorkflowEvent.matches_type` in `server/services/events/envelope.py`.
 * Test parity is locked by `client/src/types/__tests__/cloudEvents.test.ts`
 * vs the corresponding pytest cases.
 *
 *   matchesType(e, 'stripe.charge.succeeded')  // exact
 *   matchesType(e, 'stripe.charge.*')          // prefix glob
 *   matchesType(e, 'stripe.*')                 // prefix glob (1 segment)
 *   matchesType(e, 'all')                      // wildcard
 *   matchesType(e, '')                         // wildcard
 */
export function matchesType(event: WorkflowEvent, pattern: string): boolean {
  if (!pattern || pattern === 'all') return true;
  if (pattern.endsWith('.*')) {
    const prefix = pattern.slice(0, -2);
    return event.type === prefix || event.type.startsWith(prefix + '.');
  }
  return event.type === pattern;
}
