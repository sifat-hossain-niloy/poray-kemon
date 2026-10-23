-- Append-only trail of staff actions (who hid/deleted/approved what, catalog
-- edits, staff management, logins).
CREATE TABLE "admin_audit_log" (
    "id" SERIAL NOT NULL,
    "admin_id" INTEGER,
    "admin_username" VARCHAR(100) NOT NULL,
    "action" VARCHAR(64) NOT NULL,
    "target_type" VARCHAR(32) NOT NULL,
    "target_id" VARCHAR(64) NOT NULL,
    "details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_log_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "admin_audit_log_created_idx" ON "admin_audit_log"("created_at" DESC);
CREATE INDEX "admin_audit_log_target_idx" ON "admin_audit_log"("target_type", "target_id");

ALTER TABLE "admin_audit_log"
  ADD CONSTRAINT "admin_audit_log_admin_id_fkey"
  FOREIGN KEY ("admin_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
