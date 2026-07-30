import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Avatar } from './Avatar';
import type { RoadmapChatMessage } from '@streaktrack/shared';
import { API_ROUTES } from '@streaktrack/shared';
import { getApiUrl } from '../utils/api.js';
import toast from 'react-hot-toast';

interface StudyChatPanelProps {
  messages: RoadmapChatMessage[];
  currentUserId: number;
  partnerName: string;
  partnerIsOnline: boolean;
  onNewMessage: (msg: RoadmapChatMessage) => void;
}

export const StudyChatPanel: React.FC<StudyChatPanelProps> = ({
  messages,
  currentUserId,
  partnerName,
  partnerIsOnline,
  onNewMessage,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const [chatText, setChatText] = useState('');
  const [sending, setSending] = useState(false);
  const [unread, setUnread] = useState(0);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const prevMsgCount = useRef(messages.length);

  // Track unread count when collapsed
  useEffect(() => {
    if (collapsed && messages.length > prevMsgCount.current) {
      setUnread((u) => u + (messages.length - prevMsgCount.current));
    }
    prevMsgCount.current = messages.length;
  }, [messages.length, collapsed]);

  // Clear unread when opened
  useEffect(() => {
    if (!collapsed) setUnread(0);
  }, [collapsed]);

  // Auto-scroll to latest
  useEffect(() => {
    if (!collapsed) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, collapsed]);

  const handleSend = useCallback(
    async (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      const text = chatText.trim();
      if (!text) return;
      if (text.length > 1500) {
        toast.error('Max 1500 characters');
        return;
      }
      try {
        setSending(true);
        setChatText('');
        const res = await fetch(getApiUrl(API_ROUTES.ROADMAP_CHAT), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
          credentials: 'include',
        });
        if (!res.ok) throw new Error('Failed to send');
        const data = await res.json();
        if (data.chatMessage) {
          onNewMessage(data.chatMessage);
        }
      } catch {
        toast.error('Failed to send message');
      } finally {
        setSending(false);
      }
    },
    [chatText, onNewMessage],
  );

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="rounded-3xl border border-stone-200/80 bg-white shadow-sm overflow-hidden border-t-3 border-t-violet-500">
      {/* Header */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-stone-50 transition-colors cursor-pointer"
        aria-label="Toggle study chat"
      >
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-100 text-violet-600 text-base">
            💬
          </div>
          <div className="text-left">
            <p className="text-xs font-black text-slate-800">Study Chat</p>
            <div className="flex items-center gap-1.5">
              <span
                className={`h-1.5 w-1.5 rounded-full ${partnerIsOnline ? 'bg-emerald-500' : 'bg-slate-400'}`}
              />
              <span className="text-[10px] font-semibold text-slate-500">
                {partnerName} {partnerIsOnline ? '· Online' : '· Offline'}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {unread > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-violet-600 text-[10px] font-black text-white px-1">
              {unread}
            </span>
          )}
          <svg
            className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${collapsed ? '' : 'rotate-180'}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Chat Body */}
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            key="chat-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            {/* Messages Area */}
            <div className="h-64 overflow-y-auto px-4 py-3 space-y-3 bg-slate-50/60 border-t border-stone-200/80">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center gap-2">
                  <span className="text-3xl">👋</span>
                  <p className="text-xs font-semibold text-slate-400 max-w-[180px]">
                    No messages yet. Say hi to {partnerName}!
                  </p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isMe = msg.senderId === currentUserId;
                  return (
                    <div
                      key={msg.id}
                      className={`flex items-end gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}
                    >
                      {!isMe && (
                        <Avatar name={msg.senderName} src={msg.senderAvatar} size="sm" />
                      )}
                      <div className={`max-w-[75%] space-y-0.5 ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                        <span className={`text-[9px] font-bold text-slate-400 px-1 ${isMe ? 'text-right' : 'text-left'}`}>
                          {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <div
                          className={`px-3 py-2 rounded-2xl text-xs font-medium leading-relaxed break-words shadow-sm ${
                            isMe
                              ? 'bg-gradient-to-br from-violet-600 to-indigo-600 text-white rounded-br-sm'
                              : 'bg-white border border-stone-200 text-slate-700 rounded-bl-sm'
                          }`}
                        >
                          {msg.text}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <form
              onSubmit={handleSend}
              className="flex items-end gap-2 px-4 py-3 border-t border-stone-200/80 bg-white"
            >
              <textarea
                rows={1}
                maxLength={1500}
                value={chatText}
                onChange={(e) => setChatText(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Message... (Enter to send)"
                className="flex-1 resize-none rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-400/20 transition-all min-h-[36px] max-h-24"
                style={{ overflowY: 'auto' }}
              />
              <button
                type="submit"
                disabled={sending || !chatText.trim()}
                className="shrink-0 h-9 w-9 flex items-center justify-center rounded-xl bg-violet-600 hover:bg-violet-500 text-white shadow-sm disabled:opacity-40 transition-all cursor-pointer"
                aria-label="Send message"
              >
                <svg className="w-4 h-4 rotate-90" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                </svg>
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
