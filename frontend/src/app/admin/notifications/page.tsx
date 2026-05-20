'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import { toast } from '@/lib/toast';
import { Icon } from '@/components/icons/Icon';
import { formatDate } from '@/lib/dates';

interface SentMessage {
  _id: string; type: 'individual' | 'broadcast'; recipient_id: string | null;
  title: string; body: string; priority: string; created_by: string;
  dismissed_by: string[]; expires_at: string; created_at: string;
}

interface Template {
  _id: string; name: string; title: string; body: string; priority: string;
}

type Tab = 'compose' | 'sent' | 'templates';

function priorityBadgeClass(priority: string): string {
  if (priority === 'urgent') return 'bg-red-500/20 text-red-400 border-red-500/30';
  if (priority === 'important') return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
  return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
}

function tabClass(active: boolean): string {
  if (active) return 'px-4 py-2.5 border-none bg-transparent cursor-pointer text-sm min-h-[44px] transition-colors font-bold text-orange-400 border-b-2 border-orange-400';
  return 'px-4 py-2.5 border-none bg-transparent cursor-pointer text-sm min-h-[44px] transition-colors text-white/40 border-b-2 border-transparent hover:text-white/60';
}

function inputClass(): string {
  return 'w-full px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/30 outline-none focus:border-orange-500/50 min-h-[36px]';
}

function selectClass(): string {
  return 'px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm outline-none focus:border-orange-500/50 min-h-[36px]';
}

export default function AdminNotificationsPage() {
  const [tab, setTab] = useState<Tab>('compose');

  const [msgType, setMsgType] = useState<'individual' | 'broadcast'>('broadcast');
  const [recipientQuery, setRecipientQuery] = useState('');
  const [recipient, setRecipient] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [priority, setPriority] = useState<'info' | 'important' | 'urgent'>('info');
  const [expiresIn, setExpiresIn] = useState(30);
  const [sending, setSending] = useState(false);

  const [sentMessages, setSentMessages] = useState<SentMessage[]>([]);
  const [sentPage, setSentPage] = useState(1);
  const [sentTotal, setSentTotal] = useState(0);

  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateName, setTemplateName] = useState('');
  const [templateTitle, setTemplateTitle] = useState('');
  const [templateBody, setTemplateBody] = useState('');
  const [templatePriority, setTemplatePriority] = useState<'info' | 'important' | 'urgent'>('info');
  const [showTemplateForm, setShowTemplateForm] = useState(false);

  const fetchSent = useCallback(async (page: number) => {
    try {
      const data = await apiFetch<{ messages: SentMessage[]; pagination: { total: number } }>(`/admin/messages?page=${page}&limit=20`);
      setSentMessages(data.messages);
      setSentTotal(data.pagination.total);
    } catch {}
  }, []);

  const fetchTemplates = useCallback(async () => {
    try {
      const data = await apiFetch<{ templates: Template[] }>('/admin/messages/templates');
      setTemplates(data.templates);
    } catch {}
  }, []);

  useEffect(() => { if (tab === 'sent') fetchSent(sentPage); }, [tab, sentPage, fetchSent]);
  useEffect(() => { if (tab === 'templates') fetchTemplates(); }, [tab, fetchTemplates]);

  const handleSend = async () => {
    if (!title.trim() || !body.trim()) return toast.error('Title and body are required');
    if (msgType === 'individual' && !recipient) return toast.error('Select a recipient');
    setSending(true);
    try {
      await apiFetch('/admin/messages', {
        method: 'POST',
        body: JSON.stringify({
          type: msgType,
          recipient_id: msgType === 'individual' ? recipient : null,
          title: title.trim(),
          body: body.trim(),
          priority,
          expires_in_days: expiresIn,
        }),
      });
      toast.success(msgType === 'broadcast' ? 'Broadcast sent to all users' : 'Message sent');
      setTitle(''); setBody(''); setRecipient(null); setRecipientQuery('');
    } catch (e) { toast.error((e as Error)?.message || 'Failed to send'); }
    setSending(false);
  };

  const handleRetract = async (id: string) => {
    if (!confirm('Retract this message? It will no longer be shown to users.')) return;
    try {
      await apiFetch(`/admin/messages/${id}`, { method: 'DELETE' });
      fetchSent(sentPage);
      toast.success('Message retracted');
    } catch (e) { toast.error((e as Error)?.message || 'Failed'); }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm('Delete this template?')) return;
    try {
      await apiFetch(`/admin/messages/templates/${id}`, { method: 'DELETE' });
      fetchTemplates();
      toast.success('Template deleted');
    } catch { toast.error('Failed'); }
  };

  const handleSaveTemplate = async () => {
    if (!templateName.trim() || !templateTitle.trim() || !templateBody.trim()) return toast.error('All fields required');
    try {
      await apiFetch('/admin/messages/templates', {
        method: 'POST',
        body: JSON.stringify({ name: templateName.trim(), title: templateTitle.trim(), body: templateBody.trim(), priority: templatePriority }),
      });
      fetchTemplates();
      setTemplateName(''); setTemplateTitle(''); setTemplateBody('');
      setShowTemplateForm(false);
      toast.success('Template saved');
    } catch (e) { toast.error((e as Error)?.message || 'Failed'); }
  };

  const applyTemplate = (t: Template) => {
    setTitle(t.title);
    setBody(t.body);
    setPriority(t.priority as 'info' | 'important' | 'urgent');
    setTab('compose');
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold flex items-center gap-2 text-white">
        <Icon name="Mail" size={22} /> Notifications
      </h1>

      <div className="flex gap-0 border-b border-white/10 flex-wrap">
        <button onClick={() => setTab('compose')} className={tabClass(tab === 'compose')}>Compose</button>
        <button onClick={() => setTab('sent')} className={tabClass(tab === 'sent')}>Sent</button>
        <button onClick={() => setTab('templates')} className={tabClass(tab === 'templates')}>Templates</button>
      </div>

      {/* COMPOSE */}
      {tab === 'compose' && (
        <div className="w-full space-y-4">
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={() => { setMsgType('broadcast'); setRecipient(null); }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer min-h-[36px] flex items-center gap-1.5 transition-colors ${msgType === 'broadcast' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-white/5 text-white/40 border border-white/10 hover:bg-white/10'}`}
            >
              <Icon name="Megaphone" size={14} /> Broadcast to All
            </button>
            <button
              onClick={() => setMsgType('individual')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer min-h-[36px] flex items-center gap-1.5 transition-colors ${msgType === 'individual' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-white/5 text-white/40 border border-white/10 hover:bg-white/10'}`}
            >
              <Icon name="User" size={14} /> Individual User
            </button>
          </div>

          {msgType === 'individual' && (
            <div>
              <label className="block text-xs text-white/40 mb-1">Recipient username</label>
              <input value={recipientQuery} onChange={e => { setRecipientQuery(e.target.value); setRecipient(e.target.value || null); }} placeholder="e.g. a_9Gh7" className={inputClass()} />
            </div>
          )}

          <div>
            <label className="block text-xs text-white/40 mb-1">Title</label>
            <input value={title} onChange={e => setTitle(e.target.value)} maxLength={100} placeholder="e.g. Your post needs revision" className={inputClass()} />
          </div>

          <div>
            <label className="block text-xs text-white/40 mb-1">Message</label>
            <textarea value={body} onChange={e => setBody(e.target.value)} maxLength={2000} rows={5} placeholder="Write your message..." className={`${inputClass()} font-inherit`} />
            <span className="text-[11px] text-white/30">{body.length}/2000</span>
          </div>

          <div className="flex gap-4 flex-wrap">
            <div>
              <label className="block text-xs text-white/40 mb-1">Priority</label>
              <select value={priority} onChange={e => setPriority(e.target.value as typeof priority)} className={selectClass()}>
                <option value="info" className="bg-zinc-900">Info</option>
                <option value="important" className="bg-zinc-900">Important</option>
                <option value="urgent" className="bg-zinc-900">Urgent</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-white/40 mb-1">Expires in (days)</label>
              <input type="number" value={expiresIn} onChange={e => setExpiresIn(parseInt(e.target.value) || 1)} min={1} max={365} className="w-[80px] px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm outline-none focus:border-orange-500/50 min-h-[36px]" />
            </div>
          </div>

          <button onClick={handleSend} disabled={sending}
            className={`px-5 py-2.5 rounded-xl text-white font-bold cursor-pointer min-h-[44px] flex items-center gap-2 transition-colors ${sending ? 'bg-white/10 cursor-not-allowed' : 'bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600'}`}
          >
            {sending ? 'Sending...' : msgType === 'broadcast' ? <><Icon name="Megaphone" size={14} /> Send to All Users</> : <><Icon name="User" size={14} /> Send Message</>}
          </button>
        </div>
      )}

      {/* SENT */}
      {tab === 'sent' && (
        <div>
          <div className="mb-3 text-sm text-white/40 flex items-center gap-3 flex-wrap">
            <span>{sentTotal} messages sent</span>
            {sentPage > 1 && <button onClick={() => setSentPage(p => p - 1)} className="px-2.5 py-1 rounded-md text-xs bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 cursor-pointer min-h-[32px]">Prev</button>}
            {sentTotal > sentPage * 20 && <button onClick={() => setSentPage(p => p + 1)} className="px-2.5 py-1 rounded-md text-xs bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 cursor-pointer min-h-[32px]">Next</button>}
          </div>

          <div className="space-y-2">
            {sentMessages.map(m => (
              <div key={m._id} className="bg-white/[0.02] border border-white/5 rounded-2xl p-3.5">
                <div className="flex justify-between items-center mb-1.5 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase ${priorityBadgeClass(m.priority)}`}>
                      {m.priority.toUpperCase()}
                    </span>
                    <span className="text-[11px] text-white/40 flex items-center gap-1">
                      {m.type === 'broadcast' ? <><Icon name="Megaphone" size={11} /> Broadcast</> : <><Icon name="User" size={11} /> Individual</>}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-white/30" suppressHydrationWarning>{formatDate(m.created_at)}</span>
                    <button onClick={() => handleRetract(m._id)} className="px-2.5 py-1 rounded-md text-[11px] text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-colors cursor-pointer min-h-[32px]">
                      Retract
                    </button>
                  </div>
                </div>
                <strong className="text-sm text-white block mb-1">{m.title}</strong>
                <p className="text-xs text-white/50 mb-1">{m.body.substring(0, 150)}{m.body.length > 150 ? '...' : ''}</p>
                <div className="text-[11px] text-white/30">
                  {m.type === 'broadcast' ? `${m.dismissed_by.length} dismissed` : `To: ${m.recipient_id}`}
                  {' · '}Expires: <span suppressHydrationWarning>{formatDate(m.expires_at)}</span>
                </div>
              </div>
            ))}
          </div>
          {sentMessages.length === 0 && (
            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-10 text-center">
              <p className="text-white/40 text-sm">No messages sent yet</p>
            </div>
          )}
        </div>
      )}

      {/* TEMPLATES */}
      {tab === 'templates' && (
        <div>
          <div className="flex justify-between items-center mb-3 flex-wrap gap-2">
            <span className="text-sm text-white/40">{templates.length} templates</span>
            <button onClick={() => setShowTemplateForm(!showTemplateForm)} className="px-4 py-1.5 rounded-lg text-white text-xs font-semibold cursor-pointer min-h-[36px] bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 transition-all">
              {showTemplateForm ? 'Cancel' : '+ New Template'}
            </button>
          </div>

          {showTemplateForm && (
            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 mb-4 space-y-3">
              <input value={templateName} onChange={e => setTemplateName(e.target.value)} placeholder="Template name (e.g. 'Revision needed')" className={inputClass()} />
              <input value={templateTitle} onChange={e => setTemplateTitle(e.target.value)} placeholder="Default title" className={inputClass()} />
              <textarea value={templateBody} onChange={e => setTemplateBody(e.target.value)} placeholder="Default body" rows={3} className={`${inputClass()} font-inherit`} />
              <div className="flex gap-3 items-center flex-wrap">
                <select value={templatePriority} onChange={e => setTemplatePriority(e.target.value as typeof templatePriority)} className={selectClass()}>
                  <option value="info" className="bg-zinc-900">Info</option>
                  <option value="important" className="bg-zinc-900">Important</option>
                  <option value="urgent" className="bg-zinc-900">Urgent</option>
                </select>
                <button onClick={handleSaveTemplate} className="px-4 py-1.5 rounded-lg text-white text-xs font-semibold cursor-pointer bg-green-700 hover:bg-green-600 transition-colors min-h-[36px]">
                  Save
                </button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {templates.map(t => (
              <div key={t._id} className="bg-white/[0.02] border border-white/5 rounded-2xl p-3.5 flex justify-between items-center gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <strong className="text-sm text-white">{t.name}</strong>
                    <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase ${priorityBadgeClass(t.priority)}`}>{t.priority}</span>
                  </div>
                  <p className="text-xs text-white/50">{t.title}: {t.body.substring(0, 80)}</p>
                </div>
                <div className="flex gap-2 items-center shrink-0">
                  <button onClick={() => applyTemplate(t)} className="px-3 py-1 rounded-md text-[11px] text-blue-400 bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20 transition-colors cursor-pointer min-h-[32px]">Use</button>
                  <button onClick={() => handleDeleteTemplate(t._id)} className="px-3 py-1 rounded-md text-[11px] text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-colors cursor-pointer min-h-[32px]">Delete</button>
                </div>
              </div>
            ))}
          </div>
          {templates.length === 0 && (
            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-10 text-center">
              <p className="text-white/40 text-sm">No templates yet. Create reusable message templates for common notifications.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
