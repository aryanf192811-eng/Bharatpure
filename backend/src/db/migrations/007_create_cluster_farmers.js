exports.shorthands = undefined;

// M2M: which farmers belong to which cluster. Per BHARATPURE-DB.md table 7.
exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE cluster_farmers (
      cluster_id  UUID NOT NULL REFERENCES clusters(id),
      farmer_id   UUID NOT NULL REFERENCES farmer_profiles(id),
      joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (cluster_id, farmer_id)
    );
  `);
};

exports.down = (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS cluster_farmers CASCADE;`);
};
