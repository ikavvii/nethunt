import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { MessageSquare, Send, Heart, Clock, Sparkles, Filter } from 'lucide-react';

export default function MemoryWall({ onOpenAuth }) {
  const { user, token } = useAuth();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState('ALL');

  const fetchMessages = async () => {
    try {
      const res = await fetch('/api/shoutbox');
      const json = await res.json();
      setMessages(json.messages || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 12000);
    return () => clearInterval(interval);
  }, []);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || submitting || !token) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/shoutbox', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ message: newMessage })
      });

      if (res.ok) {
        const json = await res.json();
        setMessages(prev => [json.post, ...prev]);
        setNewMessage('');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  const batches = Array.from(new Set(messages.map(m => m.batch).filter(Boolean))).sort().reverse();

  const filtered = selectedBatch === 'ALL' 
    ? messages 
    : messages.filter(m => m.batch === selectedBatch);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto space-y-2">
        <div className="inline-flex items-center space-x-1.5 bg-blue-950/60 border border-blue-500/30 px-3 py-1 rounded-full text-xs font-mono font-bold text-blue-300">
          <MessageSquare className="w-3.5 h-3.5 text-blue-400" />
          <span>ALUMNI MEMORY VAULT</span>
        </div>
        <h1 className="text-3xl font-extrabold text-white">
          Nostalgia Wall & Shoutbox
        </h1>
        <p className="text-slate-300 text-sm">
          Leave a memory of your MCA days at PSG Tech. F-Block memories, late-night symposium preps, canteen coffee, and hostel banter welcome!
        </p>
      </div>

      {/* Post Form */}
      <div className="glass-panel rounded-2xl border border-slate-800 p-4 md:p-6 shadow-xl">
        {user ? (
          <form onSubmit={handleSendMessage} className="space-y-3">
            <div className="flex items-center space-x-2 text-xs text-slate-400">
              <div className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center text-[10px] font-bold font-mono">
                {user.name ? user.name[0] : 'A'}
              </div>
              <span className="font-bold text-white">{user.name}</span>
              <span className="bg-amber-400/20 text-amber-300 px-2 py-0.5 rounded font-mono text-[10px]">
                Batch of {user.batch}
              </span>
            </div>

            <div className="relative">
              <textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Share a nostalgic memory, cheer for your batch, or recall an iconic PSG Tech professor/moment..."
                rows={3}
                maxLength={400}
                className="w-full p-3.5 rounded-xl bg-slate-900/90 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/30"
              />
              <span className="absolute bottom-2.5 right-3 text-[10px] text-slate-500 font-mono">
                {newMessage.length} / 400
              </span>
            </div>

            <div className="flex justify-between items-center">
              <p className="text-[11px] text-slate-400 italic">
                Seen live by all participating alumni & faculty.
              </p>
              <button
                type="submit"
                disabled={submitting || !newMessage.trim()}
                className="px-5 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs flex items-center space-x-1.5 shadow-md shadow-amber-500/20 disabled:opacity-50 transition-all"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{submitting ? 'Posting...' : 'Post Memory'}</span>
              </button>
            </div>
          </form>
        ) : (
          <div className="text-center py-6">
            <p className="text-slate-300 text-sm mb-3">
              Sign in with your MCA Batch to leave your memory on the alumni wall!
            </p>
            <button
              onClick={onOpenAuth}
              className="px-6 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs"
            >
              Sign In to Post
            </button>
          </div>
        )}
      </div>

      {/* Filter by Batch */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">
          Recent Memories ({filtered.length})
        </span>

        <div className="flex items-center space-x-2 text-xs">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={selectedBatch}
            onChange={(e) => setSelectedBatch(e.target.value)}
            className="bg-slate-900 border border-slate-700 text-white text-xs px-2.5 py-1 rounded-lg focus:outline-none focus:border-amber-400"
          >
            <option value="ALL">All Batches</option>
            {batches.map(b => (
              <option key={b} value={b}>Batch of {b}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Memories Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((msg) => (
          <div 
            key={msg.id} 
            className="glass-panel p-5 rounded-xl border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between space-y-3"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-mono font-bold text-slate-300">
                    {msg.name ? msg.name[0] : 'A'}
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-xs leading-none">{msg.name}</h4>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">@{msg.username}</p>
                  </div>
                </div>

                <span className="text-xs bg-blue-950 text-blue-300 border border-blue-800 px-2 py-0.5 rounded font-mono font-bold">
                  {msg.batch}
                </span>
              </div>

              <p className="text-slate-200 text-xs leading-relaxed font-sans pt-1">
                "{msg.message}"
              </p>
            </div>

            <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px] text-slate-400 font-mono">
              <span className="flex items-center space-x-1">
                <Clock className="w-3 h-3" />
                <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </span>
              <span className="text-amber-400/80">PSG Tech MCA</span>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}
