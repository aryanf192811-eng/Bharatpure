exports.shorthands = undefined;

// The immutable append-only event log — every physical action on a batch creates one row.
// Per BHARATPURE-DB.md table 10. CRITICAL: never add UPDATE or DELETE to this table, ever.
// No updated_at/deleted_at columns by design — corrections are new rows, not edits.
exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE bir_events (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      batch_id    UUID NOT NULL REFERENCES batches(id),
      event_type  VARCHAR(50) NOT NULL CHECK (event_type IN (
        'BatchCreated',
        'HarvestDataLogged',
        'ProcessingStarted',
        'ProcessingCompleted',
        'RapidTestInitiated',
        'RapidTestPassed',
        'RapidTestFailed',
        'BSampleSealed',
        'NABLTestDispatched',
        'NABLCertificateLinked',
        'BatchRejected',
        'BatchListed',
        'OrderAllocated',
        'DispatchedToHub',
        'TempLogEvent',
        'TemperatureBreachDetected',
        'DeliveredToConsumer',
        'QRScanned',
        'QRBurned',
        'EscrowReleased',
        'DisputeRaised',
        'DisputeResolved',
        'BatchWrittenOff'
      )),
      event_data  JSONB NOT NULL DEFAULT '{}',
      actor_id    UUID REFERENCES users(id),
      actor_role  VARCHAR(20),
      ip_address  VARCHAR(45),
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX idx_bir_batch ON bir_events(batch_id, created_at ASC);
    CREATE INDEX idx_bir_event_type ON bir_events(event_type);

    -- Enforce: QRBurned can only appear once per batch
    CREATE UNIQUE INDEX idx_bir_qr_burned_unique
      ON bir_events(batch_id)
      WHERE event_type = 'QRBurned';
  `);
};

exports.down = (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS bir_events CASCADE;`);
};
