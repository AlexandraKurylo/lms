-- Ключі ідемпотентності: збережена відповідь на запит із заголовком Idempotency-Key.
-- Ключ належить користувачеві, тому той самий рядок ключа від різних студентів не конфліктує.
-- fingerprint — sha256 методу, адреси й тіла запиту: той самий ключ з іншим запитом дає 422.
CREATE TABLE idempotency_keys (
  user_id     integer     NOT NULL,
  key         text        NOT NULL,
  fingerprint text        NOT NULL,
  status_code smallint    NOT NULL,
  response    jsonb       NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT idempotency_keys_pkey PRIMARY KEY (user_id, key),
  CONSTRAINT idempotency_keys_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT idempotency_keys_key_length CHECK (char_length(key) BETWEEN 1 AND 255)
);
CREATE INDEX idempotency_keys_created_at_idx ON idempotency_keys (created_at);
