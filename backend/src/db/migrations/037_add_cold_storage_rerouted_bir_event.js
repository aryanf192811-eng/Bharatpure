exports.shorthands = undefined;

// Additive-only change to bir_events.event_type's CHECK constraint -- the table itself stays
// append-only-by-design (per migration 010's own comment), this only widens the set of values a
// new row's event_type may take. Adds 'ColdStorageRerouted', used both when a breach triggers an
// automatic reroute and (with a {resolved: true} payload) when that reroute stop is later
// completed and the batch's TEMP_BREACH_REVIEW hold clears -- one event type covers both, since
// they're the two ends of the same reroute lifecycle rather than logically distinct events.
exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE bir_events DROP CONSTRAINT bir_events_event_type_check;
    ALTER TABLE bir_events ADD CONSTRAINT bir_events_event_type_check CHECK (event_type IN (
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
      'ColdStorageRerouted',
      'DeliveredToConsumer',
      'QRScanned',
      'QRBurned',
      'EscrowReleased',
      'DisputeRaised',
      'DisputeResolved',
      'BatchWrittenOff'
    ));
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE bir_events DROP CONSTRAINT bir_events_event_type_check;
    ALTER TABLE bir_events ADD CONSTRAINT bir_events_event_type_check CHECK (event_type IN (
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
    ));
  `);
};
