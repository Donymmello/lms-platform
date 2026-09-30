/** One recorded act. `metadata` shape depends on the action, so it stays loose. */
export interface AuditEvent {
  id: string;
  action: string;
  /** Null when the account was deleted; `actorEmail` still names who it was. */
  actorId: string | null;
  actorEmail: string | null;
  targetType: string | null;
  targetId: string | null;
  metadata: Record<string, unknown> | null;
  ip: string | null;
  createdAt: string;
}

export interface AuditPage {
  events: AuditEvent[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}
