import { useState, useCallback, useRef } from 'react';
import type { SSEChunk, Reference, TokenUsage } from 'shared';

interface UseSSEReturn {
  streaming: boolean;
  streamContent: string;
  references: Reference[] | null;
  usage: TokenUsage | null;
  startStream: (generator: AsyncGenerator<SSEChunk>) => Promise<string>;
  cancelStream: () => void;
}

/**
 * SSE 流式消费 Hook。
 * 管理流式状态，消费 AsyncGenerator 并累积内容。
 */
export function useSSE(): UseSSEReturn {
  const [streaming, setStreaming] = useState(false);
  const [streamContent, setStreamContent] = useState('');
  const [references, setReferences] = useState<Reference[] | null>(null);
  const [usage, setUsage] = useState<TokenUsage | null>(null);
  const abortRef = useRef(false);

  const startStream = useCallback(
    async (generator: AsyncGenerator<SSEChunk>): Promise<string> => {
      setStreaming(true);
      setStreamContent('');
      setReferences(null);
      setUsage(null);
      abortRef.current = false;
      let full = '';

      try {
        for await (const event of generator) {
          if (abortRef.current) break;
          if (event.type === 'chunk' && event.content) {
            full += event.content;
            setStreamContent(full);
          } else if (event.type === 'done') {
            setReferences(event.references || null);
            setUsage(event.usage || null);
          }
        }
      } catch (err) {
        console.error('SSE error:', err);
      } finally {
        setStreaming(false);
      }
      return full;
    },
    [],
  );

  const cancelStream = useCallback(() => {
    abortRef.current = true;
    setStreaming(false);
  }, []);

  return { streaming, streamContent, references, usage, startStream, cancelStream };
}
