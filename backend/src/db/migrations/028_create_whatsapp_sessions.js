exports.shorthands = undefined;

// WhatsApp bot conversation state machine for farmers. Per BHARATPURE-DB.md table 28.
// States: greeting, awaiting_intent, batch_query, price_query, demand_query, order_status,
// support. Session timeout (session_expires_at < NOW() -> reset to greeting, clear
// context_data) is enforced in the service layer.
exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE whatsapp_sessions (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      phone           VARCHAR(15) NOT NULL UNIQUE,
      user_id         UUID REFERENCES users(id),
      state           VARCHAR(50) NOT NULL DEFAULT 'greeting',
      context_data    JSONB NOT NULL DEFAULT '{}',
      last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      session_expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 minutes'),
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX idx_whatsapp_phone ON whatsapp_sessions(phone);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS whatsapp_sessions CASCADE;`);
};
