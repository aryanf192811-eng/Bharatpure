exports.shorthands = undefined;

// System-wide audit trail. Never deleted, no soft-delete column by design. Per
// BHARATPURE-DB.md table 30 — the final migration in the Phase 0 schema.
exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE audit_logs (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      actor_id        UUID REFERENCES users(id),
      actor_role      VARCHAR(20),
      action          VARCHAR(100) NOT NULL,
      entity_type     VARCHAR(50),
      entity_id       UUID,
      old_value       JSONB,
      new_value       JSONB,
      ip_address      VARCHAR(45),
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id, created_at DESC);
    CREATE INDEX idx_audit_actor ON audit_logs(actor_id, created_at DESC);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS audit_logs CASCADE;`);
};
