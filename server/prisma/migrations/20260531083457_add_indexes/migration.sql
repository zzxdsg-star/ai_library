-- DropIndex
DROP INDEX "idx_chunk_embedding";

-- AlterTable
ALTER TABLE "knowledge_entry" ADD COLUMN     "processing_message" TEXT;

-- CreateIndex
CREATE INDEX "chat_message_session_id_created_at_idx" ON "chat_message"("session_id", "created_at");

-- CreateIndex
CREATE INDEX "knowledge_entry_kb_id_title_idx" ON "knowledge_entry"("kb_id", "title");

-- CreateIndex
CREATE INDEX "knowledge_entry_kb_id_source_file_hash_idx" ON "knowledge_entry"("kb_id", "source_file_hash");
