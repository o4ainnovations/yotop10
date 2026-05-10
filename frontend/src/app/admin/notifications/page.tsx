'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import { toast } from '@/lib/toast';
import { Icon } from '@/components/icons/Icon';

interface SentMessage {
  _id: string; type: 'individual' | 'broadcast'; recipient_id: string | null;
  title: string; body: string; priority: string; created_by: string;
  dismissed_by: string[]; expires_at: string; created_at: string;
}

interface Template {
  _id: string; name: string; title: string; body: string; priority: string;
}

type Tab = 'compose' | 'sent' | 'templates';

const PRIORITY_COLORS: Record<string, { bg: string; text: string }> = {
  info: { bg: '#e3f2fd', text: '#1565c0' },
  important: { bg: '#fff3e0', text: '#e65100' },
  urgent: { bg: '#ffebee', text: '#c62828' },
};

export default function AdminNotificationsPage() {
  const [tab, setTab] = useState<Tab>('compose');

  // Compose state
  const [msgType, setMsgType] = useState<'individual' | 'broadcast'>('broadcast');
  const [recipientQuery, setRecipientQuery] = useState('');
  const [recipient, setRecipient] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [priority, setPriority] = useState<'info' | 'important' | 'urgent'>('info');
  const [expiresIn, setExpiresIn] = useState(30);
  const [sending, setSending] = useState(false);

  // Sent state
  const [sentMessages, setSentMessages] = useState<SentMessage[]>([]);
  const [sentPage, setSentPage] = useState(1);
  const [sentTotal, setSentTotal] = useState(0);

  // Templates state
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

  const BTN = (active: boolean) => ({
    padding: '8px 16px', border: 'none', borderBottom: active ? '2px solid #1565c0' : '2px solid transparent',
    background: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: active ? 'bold' as const : 'normal' as const,
    color: active ? '#1565c0' : '#666',
  });

  return (
    <div>
      <h1 style={{ fontSize: '20px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}><Icon name="Mail" size={22} /> Notifications</h1>

      <div style={{ display: 'flex', gap: '0', marginBottom: '16px', borderBottom: '1px solid #ddd' }}>
        <button style={BTN(tab === 'compose')} onClick={() => setTab('compose')}>Compose</button>
        <button style={BTN(tab === 'sent')} onClick={() => setTab('sent')}>Sent</button>
        <button style={BTN(tab === 'templates')} onClick={() => setTab('templates')}>Templates</button>
      </div>

      {/* ═══ COMPOSE ══════════════════════════════════════════════ */}
      {tab === 'compose' && (
        <div style={{ maxWidth: '700px' }}>
          <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
            <button onClick={() => { setMsgType('broadcast'); setRecipient(null); }}
              style={{ padding: '6px 16px', border: msgType === 'broadcast' ? '2px solid #1565c0' : '1px solid #ddd', background: msgType === 'broadcast' ? '#e3f2fd' : 'white', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}>
              <Icon name="Megaphone" size={14} /> Broadcast to All
            </button>
            <button onClick={() => setMsgType('individual')}
              style={{ padding: '6px 16px', border: msgType === 'individual' ? '2px solid #1565c0' : '1px solid #ddd', background: msgType === 'individual' ? '#e3f2fd' : 'white', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}>
              <Icon name="User" size={14} /> Individual User
            </button>
          </div>

          {msgType === 'individual' && (
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '12px', color: '#666' }}>Recipient username</label>
              <input value={recipientQuery} onChange={e => { setRecipientQuery(e.target.value); setRecipient(e.target.value || null); }}
                placeholder="e.g. a_9Gh7" style={{ width: '100%', padding: '6px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '13px', marginTop: '4px' }} />
            </div>
          )}

          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '12px', color: '#666' }}>Title</label>
            <input value={title} onChange={e => setTitle(e.target.value)} maxLength={100}
              placeholder="e.g. Your post needs revision" style={{ width: '100%', padding: '6px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '13px', marginTop: '4px' }} />
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '12px', color: '#666' }}>Message</label>
            <textarea value={body} onChange={e => setBody(e.target.value)} maxLength={2000} rows={5}
              placeholder="Write your message..." style={{ width: '100%', padding: '6px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '13px', marginTop: '4px', fontFamily: 'inherit' }} />
            <span style={{ fontSize: '11px', color: '#999' }}>{body.length}/2000</span>
          </div>

          <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
            <div>
              <label style={{ fontSize: '12px', color: '#666' }}>Priority</label>
              <select value={priority} onChange={e => setPriority(e.target.value as typeof priority)} style={{ padding: '6px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '13px' }}>
                <option value="info">Info</option>
                <option value="important">Important</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '12px', color: '#666' }}>Expires in (days)</label>
              <input type="number" value={expiresIn} onChange={e => setExpiresIn(parseInt(e.target.value) || 1)} min={1} max={365}
                style={{ width: '60px', padding: '6px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '13px' }} />
            </div>
          </div>

          <button onClick={handleSend} disabled={sending}
            style={{ padding: '10px 24px', background: sending ? '#ccc' : '#1565c0', color: 'white', border: 'none', borderRadius: '6px', cursor: sending ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: 'bold' }}>
            {sending ? 'Sending...' : msgType === 'broadcast' ? <><Icon name="Megaphone" size={14} /> Send to All Users</> : <><Icon name="User" size={14} /> Send Message</>}
          </button>
        </div>
      )}

      {/* ═══ SENT ══════════════════════════════════════════════════ */}
      {tab === 'sent' && (
        <div>
          <div style={{ marginBottom: '12px', fontSize: '13px', color: '#666' }}>
            {sentTotal} messages sent
            {sentPage > 1 && <button onClick={() => setSentPage(p => p - 1)} style={{ marginLeft: '8px', padding: '2px 8px', border: '1px solid #ddd', borderRadius: '3px', cursor: 'pointer', fontSize: '12px' }}>← Prev</button>}
            {sentTotal > sentPage * 20 && <button onClick={() => setSentPage(p => p + 1)} style={{ marginLeft: '4px', padding: '2px 8px', border: '1px solid #ddd', borderRadius: '3px', cursor: 'pointer', fontSize: '12px' }}>Next →</button>}
          </div>
          {sentMessages.map(m => (
            <div key={m._id} style={{ padding: '12px', background: '#fafafa', border: '1px solid #eee', borderRadius: '6px', marginBottom: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <div>
                  <span style={{ padding: '1px 6px', borderRadius: '3px', fontSize: '11px', fontWeight: 'bold', background: PRIORITY_COLORS[m.priority]?.bg, color: PRIORITY_COLORS[m.priority]?.text }}>
                    {m.priority.toUpperCase()}
                  </span>
                  <span style={{ marginLeft: '8px', fontSize: '11px', color: '#999' }}>{m.type === 'broadcast' ? <><Icon name="Megaphone" size={11} /> Broadcast</> : <><Icon name="User" size={11} /> Individual</>}</span>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', color: '#999' }}>{new Date(m.created_at).toLocaleDateString()}</span>
                  <button onClick={() => handleRetract(m._id)} style={{ background: 'none', border: 'none', color: '#c62828', cursor: 'pointer', fontSize: '12px' }}>Retract</button>
                </div>
              </div>
              <strong style={{ fontSize: '13px' }}>{m.title}</strong>
              <p style={{ fontSize: '12px', color: '#555', margin: '4px 0 0' }}>{m.body.substring(0, 150)}{m.body.length > 150 ? '...' : ''}</p>
              <div style={{ fontSize: '11px', color: '#999', marginTop: '4px' }}>
                {m.type === 'broadcast' ? `${m.dismissed_by.length} dismissed` : `To: ${m.recipient_id}`}
                {' · '}Expires: {new Date(m.expires_at).toLocaleDateString()}
              </div>
            </div>
          ))}
          {sentMessages.length === 0 && <div style={{ padding: '24px', textAlign: 'center', color: '#999', fontSize: '13px' }}>No messages sent yet</div>}
        </div>
      )}

      {/* ═══ TEMPLATES ══════════════════════════════════════════════ */}
      {tab === 'templates' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '13px', color: '#666' }}>{templates.length} templates</span>
            <button onClick={() => setShowTemplateForm(!showTemplateForm)} style={{ padding: '6px 14px', background: '#1565c0', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}>
              {showTemplateForm ? 'Cancel' : '+ New Template'}
            </button>
          </div>

          {showTemplateForm && (
            <div style={{ background: '#f5f5f5', padding: '16px', borderRadius: '6px', marginBottom: '16px' }}>
              <div style={{ marginBottom: '8px' }}>
                <input value={templateName} onChange={e => setTemplateName(e.target.value)} placeholder="Template name (e.g. 'Revision needed')"
                  style={{ width: '100%', padding: '6px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '13px' }} />
              </div>
              <div style={{ marginBottom: '8px' }}>
                <input value={templateTitle} onChange={e => setTemplateTitle(e.target.value)} placeholder="Default title"
                  style={{ width: '100%', padding: '6px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '13px' }} />
              </div>
              <div style={{ marginBottom: '8px' }}>
                <textarea value={templateBody} onChange={e => setTemplateBody(e.target.value)} placeholder="Default body" rows={3}
                  style={{ width: '100%', padding: '6px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '13px', fontFamily: 'inherit' }} />
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <select value={templatePriority} onChange={e => setTemplatePriority(e.target.value as typeof templatePriority)} style={{ padding: '6px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '13px' }}>
                  <option value="info">Info</option>
                  <option value="important">Important</option>
                  <option value="urgent">Urgent</option>
                </select>
                <button onClick={handleSaveTemplate} style={{ padding: '6px 16px', background: '#2e7d32', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}>Save</button>
              </div>
            </div>
          )}

          {templates.map(t => (
            <div key={t._id} style={{ padding: '10px', border: '1px solid #eee', borderRadius: '4px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <strong style={{ fontSize: '13px' }}>{t.name}</strong>
                  <span style={{ padding: '1px 5px', borderRadius: '3px', fontSize: '10px', fontWeight: 'bold', background: PRIORITY_COLORS[t.priority]?.bg, color: PRIORITY_COLORS[t.priority]?.text }}>{t.priority}</span>
                </div>
                <p style={{ fontSize: '12px', color: '#555', margin: '2px 0 0' }}>{t.title}: {t.body.substring(0, 80)}</p>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={() => applyTemplate(t)} style={{ padding: '3px 10px', background: '#e3f2fd', color: '#1565c0', border: 'none', borderRadius: '3px', cursor: 'pointer', fontSize: '12px' }}>Use</button>
                <button onClick={() => handleDeleteTemplate(t._id)} style={{ padding: '3px 10px', background: 'none', border: '1px solid #ddd', borderRadius: '3px', cursor: 'pointer', fontSize: '12px', color: '#c62828' }}>Delete</button>
              </div>
            </div>
          ))}
          {templates.length === 0 && <div style={{ padding: '24px', textAlign: 'center', color: '#999', fontSize: '13px' }}>No templates yet. Create reusable message templates for common notifications.</div>}
        </div>
      )}
    </div>
  );
}
