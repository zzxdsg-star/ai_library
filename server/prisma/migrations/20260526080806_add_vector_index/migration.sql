-- IVFFlat 向量索引，加速余弦相似度检索。
-- lists=100 适用于 10 万级数据量，初期数据量小时可先用精确搜索，数据增长后再建此索引。
CREATE INDEX IF NOT EXISTS idx_chunk_embedding
  ON knowledge_chunk
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
