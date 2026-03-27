'use client';

import { useEffect, useRef, useState } from 'react';
import type { ChatMessage } from '#/common/types';
import { formatColoredText } from './chatColors';

interface ChatUIProps {
  messages: ChatMessage[];
  onSend: (msg: string) => void;
  onClose: () => void;
  prefix?: string;
  onOpened?: () => void;
}

function formatSender(sender: string) {
  return <span className='font-bold'>{formatColoredText(sender, 'text-yellow-300')}</span>;
}

export function ChatUI({ messages, onSend, onClose, prefix, onOpened }: ChatUIProps) {
  const [text, setText] = useState('');
  const [isComposing, setIsComposing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    if (prefix) {
      setText(prefix);
      onOpened?.();
    }
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    });
  }, [onOpened, prefix]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isComposing) return;
    if (text.trim()) {
      onSend(text.trim());
      setText('');
    } else {
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onClose();
      return;
    }
    e.stopPropagation();
  };

  return (
    <div className='absolute bottom-20 left-2 w-80' data-testid='mineweb-chat-overlay'>
      <div
        ref={scrollRef}
        className='mb-1 max-h-48 space-y-0.5 overflow-y-auto rounded bg-black/60 p-2'
        data-testid='mineweb-chat-feed'
      >
        {messages.length === 0 && <p className='text-xs text-white/30'>No messages yet. Type /help for commands</p>}
        {messages.map((m) => (
          <div key={m.id} className='text-xs text-white/80'>
            {formatSender(m.sender)}: {formatColoredText(m.message)}
          </div>
        ))}
      </div>
      <form onSubmit={handleSubmit} className='flex gap-1'>
        <input
          ref={inputRef}
          className='input input-bordered input-sm flex-1 bg-black/70 text-white border-white/20 placeholder-white/30'
          inputMode='text'
          autoComplete='off'
          data-testid='mineweb-chat-input'
          value={text}
          onChange={(e) => setText(e.target.value)}
          onCompositionStart={() => setIsComposing(true)}
          onCompositionEnd={() => setIsComposing(false)}
          onKeyDown={handleKeyDown}
          placeholder='Message or /command...'
        />
      </form>
    </div>
  );
}
