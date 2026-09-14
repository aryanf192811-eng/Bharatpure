exports.shorthands = undefined;

// Users table — base identity for all 5 roles. Per BHARATPURE-DB.md table 1.
exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE users (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      phone           VARCHAR(15) UNIQUE NOT NULL,
      email           VARCHAR(255) UNIQUE,
      password_hash   VARCHAR(255) NOT NULL,
      role            VARCHAR(20) NOT NULL CHECK (role IN ('FARMER','CONSUMER','BULK_BUYER','LOGISTICS','ADMIN')),
      status          VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','suspended')),
      full_name       VARCHAR(255) NOT NULL,
      otp_hash        VARCHAR(255),
      otp_expires_at  TIMESTAMPTZ,
      otp_purpose     VARCHAR(30) CHECK (otp_purpose IN ('registration','password_reset')),
      last_login_at   TIMESTAMPTZ,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at      TIMESTAMPTZ DEFAULT NULL
    );

    CREATE INDEX idx_users_phone ON users(phone) WHERE deleted_at IS NULL;
    CREATE INDEX idx_users_email ON users(email) WHERE email IS NOT NULL AND deleted_at IS NULL;
    CREATE INDEX idx_users_role ON users(role) WHERE deleted_at IS NULL;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS users CASCADE;`);
};
