'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ChatMessage } from '#/common/types';
import { formatColoredText } from './chatColors';

interface ChatFeedProps {
  messages: ChatMessage[];
  maxVisible?: number;
  fadeAfterMs?: number;
}

type DisplayMessage = ChatMessage & { count: number };

function deduplicateMessages(messages: ChatMessage[]): DisplayMessage[] {
  const result: DisplayMessage[] = [];
  for (const m of messages) {
    const prev = result[result.length - 1];
    if (prev && prev.sender === m.sender && prev.message === m.message) {
      prev.count++;
      prev.timestamp = m.timestamp;
      prev.id = m.id;
    } else {
      result.push({ ...m, count: 1 });
    }
  }
  return result;
}

function formatSender(sender: string) {
  return <span className='font-bold'>{formatColoredText(sender, 'text-yellow-300')}</span>;
}

export function ChatFeed({ messages, maxVisible = 8, fadeAfterMs = 7000 }: ChatFeedProps) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const now = Date.now();
  const deduped = useMemo(() => deduplicateMessages(messages), [messages]);
  const recent = deduped.slice(-maxVisible);

  if (recent.length === 0) return null;

  return (
    <div className='pointer-events-none absolute bottom-20 left-2 flex w-96 flex-col justify-end gap-0.5'>
      {recent.map((m) => {
        const age = now - (m.timestamp ?? now);
        const fading = age > fadeAfterMs;
        const opacity = fading
          ? Math.max(0, 1 - (age - fadeAfterMs) / 2000)
          : 1;

        if (opacity <= 0) return null;

        return (
          <div
            key={m.id}
            className='rounded bg-black/50 px-2 py-0.5 text-xs leading-normal text-white/90 transition-opacity duration-500'
            style={{ opacity }}
          >
            {formatSender(m.sender)}: {formatColoredText(m.message)}
            {m.count > 1 && <span className='ml-1 text-white/50'>x{m.count}</span>}
          </div>
        );
      })}
    </div>
  );
}
