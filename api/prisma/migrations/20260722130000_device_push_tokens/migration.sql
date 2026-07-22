-- CreateTable
CREATE TABLE IF NOT EXISTS "device_push_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "society_id" UUID,
    "expo_token" TEXT NOT NULL,
    "platform" VARCHAR(16),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "device_push_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "device_push_tokens_user_id_expo_token_key" ON "device_push_tokens"("user_id", "expo_token");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "device_push_tokens_society_id_idx" ON "device_push_tokens"("society_id");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'device_push_tokens_user_id_fkey'
  ) THEN
    ALTER TABLE "device_push_tokens" ADD CONSTRAINT "device_push_tokens_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
