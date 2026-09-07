'use client';

import { useEffect, useRef, useState, type SyntheticEvent } from 'react';
import {
  ArrowRight, BarChart3, Building2, CalendarDays, Camera, Check, ChevronDown,
  CircleUserRound, Clock3, FileText, LayoutDashboard, Menu, Mic, Plus, QrCode,
  Search, Settings, ShieldCheck, Sparkles, Square, Target, UserPlus, Users, Wifi,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

const recent = [
  { name: 'Rajesh Mehta', company: 'ABC Pharma', role: 'Procurement Head', score: 92, interest: 'Machine monitoring', time: '11:42 AM' },
  { name: 'Neha Shah', company: 'ABC Pharma', role: 'IT Manager', score: 84, interest: 'SAP integration', time: '11:18 AM' },
  { name: 'Sanjay Verma', company: 'Prime Polymers', role: 'Plant Head', score: 71, interest: 'Downtime analytics', time: '10:51 AM' },
];

type SavedLead = {
  id: string; fullName: string; company: string; role?: string; note?: string;
  nextAction?: string; dueDate?: string; reviewStatus: string; createdAt: number;
};

type Analysis = {
  summary: string;
  fields: Array<{ key: string; label: string; value: string | null; confidence: number; evidence: string | null }>;
  commitments: Array<{ title: string; due_date: string | null; owner_party: string; confidence: number; evidence: string }>;
  score: { value: number; rationale: string };
  risks: string[];
};

type TaskItem = { id: string; leadId: string; title: string; dueDate?: string; status: string; fullName: string; company: string };
type Opportunity = { id: string; leadId?: string; company: string; title: string; stage: string; value: number; currency: string; probability: number; expectedCloseDate?: string };
type Account = { company: string; contacts: number; latestAt: number };
type View = 'today' | 'people' | 'opportunities' | 'rfqs' | 'events' | 'roi' | 'knowledge' | 'settings';
type AppContext = { workspace: { id: string; name: string; slug: string; timezone: string; currency: string; plan: string; status: string }; role: string; user: { id: string; email: string } };
type Member = { id: string; userId: string; email: string; displayName?: string; role: string; status: string };
type Invitation = { id: string; email: string; role: string; status: string; expiresAt: number };
type AuditEvent = { id: string; action: string; entityType: string; createdAt: number };
type KnowledgeData = { profile: null | { legalName: string; websiteUrl?: string; description?: string; targetIndustries: string[]; targetGeographies: string[]; eventObjective?: string; onboardingStep: number }; products: Array<{ id: string; name: string; kind: string; description?: string; buyerRoles: string[]; painPoints: string[] }>; icps: Array<{ id: string; name: string; industries: string[]; buyerRoles: string[]; mustHaveSignals: string[]; disqualifiers: string[] }>; rules: Array<{ id: string; label: string; field: string; expectedValue: string; weight: number }>; sources: Array<{ id: string; name: string; sourceType: string; sourceUrl?: string; contentType?: string; sizeBytes?: number; status: string }> };
type EventItem = { id: string; name: string; venue?: string; hall?: string; booth?: string; startsOn: string; endsOn: string; timezone: string; budget: number; objective?: string; products: string[]; targetAccounts: string[]; qualificationQuestions: string[]; leadRoutingRule: string; followupSlaHours: number; dailyLeadTarget: number; badgeProvider?: string; qrCampaignCode?: string; status: string };
type OfflineCapture = { id: string; workspaceId: string; eventId: string; fields: Record<string, string>; attachment?: File; attachmentKind?: string; queuedAt: number };

function openOutbox() {
  return new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open('revenue-os-offline', 1); request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains('captures')) request.result.createObjectStore('captures', { keyPath: 'id' }); }; request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
}

async function outboxWrite(value: OfflineCapture | string, mode: 'put' | 'delete') {
  const db = await openOutbox(); await new Promise<void>((resolve, reject) => { const transaction = db.transaction('captures', 'readwrite'); const store = transaction.objectStore('captures'); if (mode === 'put') store.put(value as OfflineCapture); else store.delete(value as string); transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error); }); db.close();
}

async function outboxItems() {
  const db = await openOutbox(); const items = await new Promise<OfflineCapture[]>((resolve, reject) => { const request = db.transaction('captures').objectStore('captures').getAll(); request.onsuccess = () => resolve(request.result as OfflineCapture[]); request.onerror = () => reject(request.error); }); db.close(); return items;
}

function NavItem({ icon: Icon, label, active = false, onClick }: { icon: typeof LayoutDashboard; label: string; active?: boolean; onClick: () => void }) {
  return <button className={`nav-item ${active ? 'nav-item-active' : ''}`} onClick={onClick} type="button"><Icon size={18} strokeWidth={1.8} /><span>{label}</span></button>;
}

function FeatureState({ icon: Icon, title, text }: { icon: typeof FileText; title: string; text: string }) {
  return <article className="panel feature-state"><span><Icon /></span><h2>{title}</h2><p>{text}</p><b>Planned · not simulated</b></article>;
}

function apiFetch(path: string, init?: RequestInit) {
  const headers = new Headers(init?.headers); const workspaceId = window.localStorage.getItem('revenue-workspace-id');
  if (workspaceId) headers.set('x-revenue-workspace-id', workspaceId);
  const eventId = window.localStorage.getItem('revenue-event-id');
  if (eventId) headers.set('x-revenue-event-id', eventId);
  return fetch(path, { ...init, headers });
}

export default function Home() {
  const [captureOpen, setCaptureOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [savedLead, setSavedLead] = useState<SavedLead | null>(null);
  const [capturedLeads, setCapturedLeads] = useState<SavedLead[]>([]);
  const [reviewLead, setReviewLead] = useState<SavedLead | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [extractionId, setExtractionId] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [activeView, setActiveView] = useState<View>('today');
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [metrics, setMetrics] = useState({ totalLeads: 0, qualifiedLeads: 0, openTasks: 0, pipelineValue: 0 });
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [opportunityOpen, setOpportunityOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [appContext, setAppContext] = useState<AppContext | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [availableWorkspaces, setAvailableWorkspaces] = useState<Array<AppContext['workspace'] & { role: string }>>([]);
  const [knowledge, setKnowledge] = useState<KnowledgeData>({ profile: null, products: [], icps: [], rules: [], sources: [] });
  const [events, setEvents] = useState<EventItem[]>([]);
  const [activeEventId, setActiveEventId] = useState(() => typeof window === 'undefined' ? '' : window.localStorage.getItem('revenue-event-id') || '');
  const [outboxCount, setOutboxCount] = useState(0);
  const [attachment, setAttachment] = useState<{ name: string; url: string; kind: 'card' | 'badge' | 'audio'; file: File } | null>(null);
  const [recording, setRecording] = useState(false);
  const cardInput = useRef<HTMLInputElement>(null);
  const badgeInput = useRef<HTMLInputElement>(null);
  const leadForm = useRef<HTMLFormElement>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);

  useEffect(() => {
    const context = (document as Document & { modelContext?: { registerTool: (tool: unknown, options?: { signal?: AbortSignal }) => void | Promise<void> } }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const register = context.registerTool({
      name: 'start_lead_capture',
      title: 'Start lead capture',
      description: 'Open the lead capture flow for the active exhibition event.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: () => { setCaptureOpen(true); return { status: 'capture_open', event: 'IndustrialTech Expo 2026' }; },
    }, { signal: lifecycle.signal });
    void Promise.resolve(register).catch(() => undefined);
    return () => lifecycle.abort();
  }, []);

  async function loadWorkspace() {
    apiFetch('/api/workspace').then(async (response) => {
      if (!response.ok) return;
      const data = await response.json() as { context?: AppContext; leads?: SavedLead[]; tasks?: TaskItem[]; opportunities?: Opportunity[]; accounts?: Account[]; metrics?: typeof metrics };
      setCapturedLeads(data.leads || []); setTasks(data.tasks || []); setOpportunities(data.opportunities || []); setAccounts(data.accounts || []);
      if (data.context) setAppContext(data.context);
      if (data.metrics) setMetrics(data.metrics);
    }).catch(() => undefined);
  }
  async function loadEvents() { const response = await apiFetch('/api/events'); if (response.ok) { const data = await response.json() as { events: EventItem[] }; setEvents(data.events); } }
  async function loadSettings() { const response = await apiFetch('/api/settings'); if (!response.ok) return; const data = await response.json() as { context: AppContext; members: Member[]; invitations: Invitation[]; audit: AuditEvent[]; workspaces?: Array<AppContext['workspace'] & { role: string }> }; setAppContext(data.context); setMembers(data.members); setInvitations(data.invitations); setAuditEvents(data.audit); setAvailableWorkspaces(data.workspaces || []); }
  async function loadKnowledge() { const response = await apiFetch('/api/company-intelligence'); if (response.ok) setKnowledge(await response.json() as KnowledgeData); }
  async function refreshOutbox() { try { setOutboxCount((await outboxItems()).length); } catch { setOutboxCount(0); } }
  async function flushOutbox() {
    if (!navigator.onLine) return; const queued = await outboxItems().catch(() => []); let synced = 0;
    for (const item of queued) {
      const form = new FormData(); Object.entries(item.fields).forEach(([key, value]) => form.set(key, value)); if (item.attachment) { form.set('attachment', item.attachment); form.set('attachmentKind', item.attachmentKind || 'document'); }
      try { const headers = new Headers(); if (item.workspaceId) headers.set('x-revenue-workspace-id', item.workspaceId); if (item.eventId) headers.set('x-revenue-event-id', item.eventId); const response = await fetch('/api/leads', { method: 'POST', headers, body: form }); if (!response.ok) continue; await outboxWrite(item.id, 'delete'); synced += 1; } catch { break; }
    }
    await refreshOutbox(); if (synced) { setNotice(`${synced} offline capture${synced === 1 ? '' : 's'} synchronized`); void loadWorkspace(); }
  }
  useEffect(() => { const timer = window.setTimeout(() => { void loadWorkspace(); void loadEvents(); void refreshOutbox(); }, 0); return () => window.clearTimeout(timer); }, []);
  useEffect(() => { const sync = () => { void flushOutbox(); }; window.addEventListener('online', sync); return () => window.removeEventListener('online', sync); }, []);
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setSearchOpen(true); } };
    window.addEventListener('keydown', shortcut); return () => window.removeEventListener('keydown', shortcut);
  }, []);
  function go(view: View) { setActiveView(view); setMobileNav(false); if (view === 'settings') void loadSettings(); if (view === 'knowledge') void loadKnowledge(); if (view === 'events') { void loadEvents(); void loadSettings(); } }

  async function saveLead(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setSaveError('');
    const form = new FormData(event.currentTarget);
    form.set('clientCaptureId', crypto.randomUUID());
    if (attachment) { form.set('attachment', attachment.file); form.set('attachmentKind', attachment.kind); }
    try {
      const response = await apiFetch('/api/leads', { method: 'POST', body: form });
      const data = await response.json() as { lead?: SavedLead; error?: string };
      if (!response.ok || !data.lead) throw new Error(data.error || 'Unable to save this lead.');
      setSavedLead(data.lead); setCapturedLeads((current) => [data.lead!, ...current]); setSaved(true); void loadWorkspace();
    } catch (error) {
      try {
        const fields: Record<string, string> = {}; form.forEach((value, key) => { if (typeof value === 'string') fields[key] = value; }); const id = fields.clientCaptureId;
        await outboxWrite({ id, workspaceId: window.localStorage.getItem('revenue-workspace-id') || appContext?.workspace.id || '', eventId: activeEventId, fields, attachment: attachment?.file, attachmentKind: attachment?.kind, queuedAt: Date.now() }, 'put');
        const queuedLead: SavedLead = { id: `offline-${id}`, fullName: fields.fullName, company: fields.company, role: fields.role, note: fields.note, nextAction: fields.nextAction, dueDate: fields.dueDate, reviewStatus: 'queued_offline', createdAt: Date.now() };
        setSavedLead(queuedLead); setCapturedLeads((current) => [queuedLead, ...current]); setSaved(true); await refreshOutbox();
      } catch { setSaveError(error instanceof Error ? error.message : 'Unable to save this lead.'); }
    }
    finally { setSaving(false); }
  }
  function resetCapture(open: boolean) {
    setCaptureOpen(open);
    if (!open) {
      if (recording) recorder.current?.stop();
      setTimeout(() => {
        if (attachment?.url) URL.revokeObjectURL(attachment.url);
        setAttachment(null); setSaved(false); setSavedLead(null); setSaveError('');
      }, 150);
    }
  }

  function selectAttachment(event: SyntheticEvent<HTMLInputElement>, kind: 'card' | 'badge') {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    if (attachment?.url) URL.revokeObjectURL(attachment.url);
    setAttachment({ name: file.name, url: URL.createObjectURL(file), kind, file });
  }

  async function toggleRecording() {
    if (recording) { recorder.current?.stop(); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const nextRecorder = new MediaRecorder(stream);
      audioChunks.current = [];
      nextRecorder.ondataavailable = (event) => { if (event.data.size) audioChunks.current.push(event.data); };
      nextRecorder.onstop = () => {
        const blob = new Blob(audioChunks.current, { type: nextRecorder.mimeType || 'audio/webm' });
        if (attachment?.url) URL.revokeObjectURL(attachment.url);
        const file = new File([blob], `conversation-${Date.now()}.webm`, { type: blob.type });
        setAttachment({ name: file.name, url: URL.createObjectURL(file), kind: 'audio', file });
        stream.getTracks().forEach((track) => track.stop());
        setRecording(false);
      };
      recorder.current = nextRecorder;
      nextRecorder.start(); setRecording(true); setSaveError('');
    } catch { setSaveError('Microphone access was not available. You can still type the conversation note.'); }
  }

  function useSampleLead() {
    const form = leadForm.current;
    if (!form) return;
    const set = (name: string, value: string) => { const input = form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement | null; if (input) input.value = value; };
    set('fullName', 'Rajesh Mehta'); set('company', 'ABC Pharma'); set('role', 'Procurement Head');
    set('note', 'Rajesh manages procurement at ABC Pharma. They have 40 machines in Ahmedabad and use SAP. He wants machine monitoring. Budget opens in September. I promised architecture and preliminary pricing next Tuesday.');
    set('nextAction', 'Send architecture and preliminary pricing');
  }

  function openReview(lead: SavedLead) {
    setReviewLead(lead); setAnalysis(null); setExtractionId(''); setAnalysisError(''); setConfirmed(false);
  }

  async function analyzeConversation() {
    if (!reviewLead) return;
    setAnalyzing(true); setAnalysisError('');
    try {
      const response = await apiFetch('/api/analysis', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ leadId: reviewLead.id }) });
      const data = await response.json() as { analysis?: Analysis; extractionId?: string; error?: string };
      if (!response.ok || !data.analysis || !data.extractionId) throw new Error(data.error || 'Unable to analyze this conversation.');
      setAnalysis(data.analysis); setExtractionId(data.extractionId);
    } catch (error) { setAnalysisError(error instanceof Error ? error.message : 'Unable to analyze this conversation.'); }
    finally { setAnalyzing(false); }
  }

  async function confirmAnalysis() {
    const response = await apiFetch('/api/analysis/confirm', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ extractionId }) });
    if (response.ok) { setConfirmed(true); setCapturedLeads((current) => current.map((lead) => lead.id === reviewLead?.id ? { ...lead, reviewStatus: 'confirmed' } : lead)); }
    else setAnalysisError('Could not confirm this analysis. Please try again.');
  }

  async function completeTask(id: string) {
    const response = await apiFetch('/api/workspace', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'complete_task', id }) });
    if (response.ok) { setTasks((current) => current.map((task) => task.id === id ? { ...task, status: 'complete' } : task)); setNotice('Task completed'); setTimeout(() => setNotice(''), 1800); void loadWorkspace(); }
  }

  async function createOpportunity(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault(); const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
    const response = await apiFetch('/api/workspace', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'create_opportunity', ...payload }) });
    const data = await response.json() as { opportunity?: Opportunity; error?: string };
    if (!response.ok || !data.opportunity) { setNotice(data.error || 'Could not create opportunity'); return; }
    setOpportunityOpen(false); setNotice('Opportunity created'); setTimeout(() => setNotice(''), 1800); void loadWorkspace();
  }

  async function saveSettings(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault(); const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    const response = await apiFetch('/api/settings', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'update_workspace', ...values }) });
    const data = await response.json() as { workspace?: AppContext['workspace']; error?: string };
    if (!response.ok || !data.workspace) { setNotice(data.error || 'Could not save settings'); return; }
    setAppContext((current) => current ? { ...current, workspace: data.workspace! } : current); setNotice('Workspace settings saved'); setTimeout(() => setNotice(''), 1800); void loadSettings();
  }

  async function inviteMember(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const values = Object.fromEntries(new FormData(form).entries());
    const response = await apiFetch('/api/settings', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'invite', ...values }) });
    const data = await response.json() as { invitation?: Invitation; error?: string };
    if (!response.ok || !data.invitation) { setNotice(data.error || 'Could not create invitation'); return; }
    form.reset(); setInvitations((current) => [data.invitation!, ...current]); setNotice('Invitation recorded'); setTimeout(() => setNotice(''), 1800); void loadSettings();
  }

  async function createWorkspace(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const values = Object.fromEntries(new FormData(form).entries());
    const response = await apiFetch('/api/settings', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'create_workspace', ...values }) });
    const data = await response.json() as { workspace?: AppContext['workspace']; error?: string };
    if (!response.ok || !data.workspace) { setNotice(data.error || 'Could not create workspace'); return; }
    window.localStorage.setItem('revenue-workspace-id', data.workspace.id); form.reset(); setNotice('Workspace created'); await loadWorkspace(); await loadSettings();
  }

  async function switchWorkspace(id: string) {
    window.localStorage.setItem('revenue-workspace-id', id); window.localStorage.removeItem('revenue-event-id'); setActiveEventId(''); setNotice('Workspace switched'); await loadWorkspace(); await loadSettings(); await loadEvents();
  }

  async function updateMember(id: string, role: string, status: string) {
    const response = await apiFetch('/api/settings', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'update_member', id, role, status }) });
    const data = await response.json() as { error?: string }; if (!response.ok) { setNotice(data.error || 'Could not update member'); return; }
    setNotice('Member updated'); void loadSettings();
  }

  async function revokeInvitation(id: string) {
    const response = await apiFetch('/api/settings', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'revoke_invitation', id }) });
    if (response.ok) { setNotice('Invitation revoked'); void loadSettings(); }
  }

  async function exportWorkspace() {
    const response = await apiFetch('/api/settings?export=1'); if (!response.ok) { setNotice('Export could not be prepared'); return; }
    const blob = await response.blob(); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `${appContext?.workspace.slug || 'workspace'}-export.json`; link.click(); URL.revokeObjectURL(url); setNotice('Workspace export downloaded');
  }

  async function submitKnowledge(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const values = Object.fromEntries(new FormData(form).entries());
    const response = await apiFetch('/api/company-intelligence', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(values) }); const data = await response.json() as { error?: string };
    if (!response.ok) { setNotice(data.error || 'Could not save company intelligence'); return; } form.reset(); setNotice('Company intelligence saved'); await loadKnowledge();
  }

  async function uploadKnowledge(event: SyntheticEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]; if (!file) return; const form = new FormData(); form.set('file', file);
    const response = await apiFetch('/api/company-intelligence', { method: 'POST', body: form }); const data = await response.json() as { error?: string };
    setNotice(response.ok ? 'Knowledge file stored securely' : data.error || 'Upload failed'); if (response.ok) await loadKnowledge(); event.currentTarget.value = '';
  }

  async function submitEvent(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const formData = new FormData(form); const values = Object.fromEntries(formData.entries()); values.teamMemberIds = formData.getAll('teamMemberIds').map(String).join(',');
    const response = await apiFetch('/api/events', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'create', ...values }) }); const data = await response.json() as { error?: string };
    if (!response.ok) { setNotice(data.error || 'Could not create event'); return; } form.reset(); setNotice('Event created'); await loadEvents();
  }

  async function eventAction(action: 'duplicate' | 'archive', id: string) {
    const response = await apiFetch('/api/events', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, id }) });
    const data = await response.json() as { error?: string };
    if (response.ok) { if (action === 'archive' && activeEventId === id) selectEvent(''); setNotice(action === 'duplicate' ? 'Event duplicated' : 'Event archived'); await loadEvents(); }
    else setNotice(data.error || `Could not ${action} event`);
  }

  function selectEvent(id: string) {
    if (id) window.localStorage.setItem('revenue-event-id', id); else window.localStorage.removeItem('revenue-event-id');
    setActiveEventId(id); setNotice(id ? 'Active event changed' : 'Active event cleared'); void loadWorkspace();
  }

  const activeEvent = events.find((item) => item.id === activeEventId && item.status !== 'archived');

  return (
    <main className="app-shell">
      <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
        <div className="brand"><span className="brand-mark"><Sparkles size={18} /></span><span>Revenue OS</span></div>
        <div className="workspace-switcher"><span className="workspace-logo">{appContext?.workspace.name.split(' ').map((word) => word[0]).join('').slice(0,2) || 'NA'}</span><span><strong>{appContext?.workspace.name || 'Nova Automation'}</strong><small>{appContext?.workspace.plan || 'Trial'} workspace</small></span><ChevronDown size={15} /></div>
        <nav aria-label="Main navigation">
          <p className="nav-label">Workspace</p>
          <NavItem icon={LayoutDashboard} label="Today" active={activeView === 'today'} onClick={() => go('today')} />
          <NavItem icon={Users} label="People & accounts" active={activeView === 'people'} onClick={() => go('people')} />
          <NavItem icon={Target} label="Opportunities" active={activeView === 'opportunities'} onClick={() => go('opportunities')} />
          <NavItem icon={FileText} label="RFQs & quotations" active={activeView === 'rfqs'} onClick={() => go('rfqs')} />
          <p className="nav-label nav-label-spaced">Manage</p>
          <NavItem icon={CalendarDays} label="Events" active={activeView === 'events'} onClick={() => go('events')} />
          <NavItem icon={BarChart3} label="Revenue & ROI" active={activeView === 'roi'} onClick={() => go('roi')} />
          <NavItem icon={Building2} label="Company knowledge" active={activeView === 'knowledge'} onClick={() => go('knowledge')} />
          <NavItem icon={Settings} label="Workspace settings" active={activeView === 'settings'} onClick={() => go('settings')} />
        </nav>
        <div className="sidebar-foot">
          <div className={`sync-state ${outboxCount ? 'sync-pending' : ''}`}><Wifi size={15} /><span>{outboxCount ? `${outboxCount} capture${outboxCount === 1 ? '' : 's'} waiting to sync` : 'Online · All synced'}</span></div>
          <div className="profile-row"><span className="profile-avatar">{(appContext?.user.email || 'AS').slice(0,2).toUpperCase()}</span><span><strong>{appContext?.user.email || 'Local tester'}</strong><small>{appContext?.role || 'Loading role'}</small></span></div>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setMobileNav(!mobileNav)} aria-label="Toggle navigation"><Menu /></button>
          <div className="event-context"><span className="live-dot" /> {activeEvent?.name || 'No active event'} <span>· {activeEvent ? `${activeEvent.venue || 'Venue pending'} · ${activeEvent.status}` : 'Select one in Events'}</span></div>
          <div className="topbar-actions"><button className="search-button" aria-label="Search" onClick={() => setSearchOpen(true)}><Search size={17} /><span>Search</span><kbd>Ctrl K</kbd></button><button className="icon-button" aria-label="Profile" onClick={() => { setNotice('Signed in as Arjun Singh'); setTimeout(() => setNotice(''), 1800); }}><CircleUserRound size={21} /></button></div>
        </header>

        <div className="content">
          {activeView === 'today' ? <>
          <section className="welcome-row">
            <div><p className="eyebrow">Sunday, 6 September</p><h1>Good afternoon, Arjun.</h1><p className="subtle">Three commitments need your attention today.</p></div>
            <Dialog open={captureOpen} onOpenChange={resetCapture}>
              <DialogTrigger render={<Button className="capture-button" />}><Plus size={19} strokeWidth={2.4} /> Capture lead</DialogTrigger>
              <DialogContent className="capture-dialog" showCloseButton={!saved}>
                {!saved ? <>
                  <DialogHeader><p className="dialog-kicker">{activeEvent?.name || 'Unassigned event'}</p><DialogTitle className="dialog-title">Capture a new conversation</DialogTitle><DialogDescription>Start with whatever the visitor gives you. Add the conversation immediately after.</DialogDescription></DialogHeader>
                  <div className="capture-methods">
                    <button type="button" onClick={() => cardInput.current?.click()}><Camera /><span><strong>Upload card</strong><small>Choose or photograph a visiting card</small></span></button>
                    <button type="button" onClick={() => badgeInput.current?.click()}><QrCode /><span><strong>Upload badge or QR</strong><small>Choose an image to attach</small></span></button>
                    <button type="button" className={recording ? 'recording' : ''} onClick={toggleRecording}>{recording ? <Square /> : <Mic />}<span><strong>{recording ? 'Stop recording' : 'Record conversation'}</strong><small>{recording ? 'Recording from your microphone…' : 'Capture the context that matters'}</small></span></button>
                    <input ref={cardInput} className="capture-file-input" type="file" accept="image/*" capture="environment" onInput={(event) => selectAttachment(event, 'card')} />
                    <input ref={badgeInput} className="capture-file-input" type="file" accept="image/*" capture="environment" onInput={(event) => selectAttachment(event, 'badge')} />
                  </div>
                  {attachment ? <div className="attachment-preview">{attachment.kind === 'audio' ? <audio aria-label="Recorded conversation preview" controls src={attachment.url}><track kind="captions" label="Transcript unavailable" /></audio> :
                    // oxlint-disable-next-line next/no-img-element -- Blob URLs are local previews and cannot use the image optimizer.
                    <img src={attachment.url} alt={`${attachment.kind} preview`} />}<span><strong>{attachment.name}</strong><small>Attached for this local test · automatic reading comes with OCR</small></span></div> : null}
                  <div className="or"><span>or enter the basics</span></div>
                  <form ref={leadForm} onSubmit={saveLead} className="lead-form">
                    <div className="field-grid"><div className="field-block"><label htmlFor="lead-name">Full name</label><Input id="lead-name" name="fullName" required placeholder="e.g. Rajesh Mehta" /></div><div className="field-block"><label htmlFor="lead-company">Company</label><Input id="lead-company" name="company" required placeholder="e.g. ABC Pharma" /></div></div>
                    <div className="field-block"><label htmlFor="lead-role">Role</label><Input id="lead-role" name="role" placeholder="e.g. Procurement Head" /></div>
                    <div className="field-grid"><div className="field-block"><label htmlFor="lead-email">Work email</label><Input id="lead-email" name="email" type="email" autoComplete="email" placeholder="rajesh@company.com" /></div><div className="field-block"><label htmlFor="lead-phone">Phone / WhatsApp</label><Input id="lead-phone" name="phone" type="tel" autoComplete="tel" placeholder="+91 98765 43210" /></div></div>
                    <div className="field-block"><label htmlFor="lead-note">Conversation note</label><Textarea id="lead-note" name="note" placeholder="What did they need, what did you promise, and when?" /></div>
                    <div className="field-grid"><div className="field-block"><label htmlFor="lead-action">Next action</label><Input id="lead-action" name="nextAction" placeholder="e.g. Send preliminary pricing" /></div><div className="field-block"><label htmlFor="lead-due">Due date</label><Input id="lead-due" name="dueDate" type="date" /></div></div>
                    {saveError ? <p className="form-error" role="alert">{saveError}</p> : null}
                    <button className="sample-button" type="button" onClick={useSampleLead}>Fill test conversation</button>
                    <Button type="submit" className="save-button" disabled={saving || Boolean(events.length && !activeEvent)}>{saving ? 'Saving securely…' : events.length && !activeEvent ? 'Select an event before capture' : 'Save conversation'} {!saving && (!events.length || activeEvent) && <ArrowRight />}</Button>
                    <p className="offline-note"><Wifi size={14} /> Offline-safe. Failed submissions stay on this device and retry when connection returns.</p>
                  </form>
                </> : <div className="success-state"><span className="success-icon"><Check /></span><p className="dialog-kicker">{savedLead?.reviewStatus === 'queued_offline' ? 'Saved on this device' : 'Lead saved'}</p><DialogTitle className="dialog-title">{savedLead?.fullName} is {savedLead?.reviewStatus === 'queued_offline' ? 'waiting to sync' : 'ready for review'}</DialogTitle><DialogDescription>{savedLead?.reviewStatus === 'queued_offline' ? 'Keep working. Revenue OS will retry this exact capture without creating duplicates when the connection returns.' : attachment ? 'The original file is stored securely and queued for extraction. No facts have been invented.' : 'The conversation is stored as source evidence. No facts have been invented.'}</DialogDescription><div className="saved-summary"><span><small>Account</small><strong>{savedLead?.company}</strong></span><span><small>Review</small><strong>{savedLead?.reviewStatus === 'queued_offline' ? 'Offline queue' : 'Needs review'}</strong></span>{savedLead?.nextAction ? <span><small>Commitment</small><strong>{savedLead.nextAction}</strong></span> : null}{savedLead?.dueDate ? <span><small>Due</small><strong>{savedLead.dueDate}</strong></span> : null}</div><Button className="save-button" onClick={() => resetCapture(false)}>Back to today</Button></div>}
              </DialogContent>
            </Dialog>
            <Dialog open={Boolean(reviewLead)} onOpenChange={(open) => { if (!open) setReviewLead(null); }}>
              <DialogContent className="review-dialog">
                <DialogHeader><p className="dialog-kicker">Conversation intelligence</p><DialogTitle className="dialog-title">Review {reviewLead?.fullName}</DialogTitle><DialogDescription>AI suggestions remain separate from confirmed customer facts until you approve them.</DialogDescription></DialogHeader>
                <div className="source-note"><span>Source conversation</span><p>{reviewLead?.note || 'No conversation note was captured.'}</p></div>
                {!analysis ? <div className="analysis-empty"><span className="analysis-mark"><Sparkles /></span><h3>Turn this note into accountable sales data</h3><p>Extract requirements, buying signals, commitments, deadlines, and supporting evidence.</p>{analysisError ? <div className="ai-config-warning"><strong>AI analysis unavailable</strong><span>{analysisError}</span></div> : null}<Button onClick={analyzeConversation} disabled={analyzing || !reviewLead?.note}>{analyzing ? 'Analyzing evidence…' : 'Analyze conversation'} <Sparkles /></Button></div> : <div className="analysis-result">
                  <div className="analysis-summary"><span className="analysis-score">{analysis.score.value}</span><div><small>AI qualification score · explainable</small><p>{analysis.summary}</p></div></div>
                  <div className="intelligence-grid">{analysis.fields.filter((field) => field.value).map((field) => <article key={field.key}><span>{field.label}<i>{Math.round(field.confidence * 100)}%</i></span><strong>{field.value}</strong>{field.evidence ? <q>{field.evidence}</q> : null}</article>)}</div>
                  {analysis.commitments.length ? <div className="commitments"><h3>Proposed commitments</h3>{analysis.commitments.map((item, index) => <article key={`${item.title}-${index}`}><Clock3 /><span><strong>{item.title}</strong><small>{item.due_date || 'Date needs confirmation'} · {item.owner_party}</small><q>{item.evidence}</q></span></article>)}</div> : null}
                  {analysis.risks.length ? <div className="risk-note"><strong>Needs attention</strong>{analysis.risks.join(' · ')}</div> : null}
                  <Button className="save-button" onClick={confirmAnalysis} disabled={confirmed}>{confirmed ? <><Check /> Confirmed and tasks created</> : 'Confirm facts and create tasks'}</Button>
                </div>}
              </DialogContent>
            </Dialog>
          </section>

          <section className="signal-grid" aria-label="Event performance">
            <article className="signal-card primary-signal"><div className="signal-head"><span>Captured leads</span><span className="trend">Live</span></div><strong>{metrics.totalLeads}</strong><small>{metrics.qualifiedLeads} confirmed conversations</small><div className="spark-bars" aria-hidden="true">{[32,44,37,58,49,70,63,82,76,91].map((h,i)=><i key={i} style={{height:`${h}%`}} />)}</div></article>
            <article className="signal-card"><div className="signal-head"><span>Open promises</span><span className="mini-icon amber"><Clock3 /></span></div><strong>{metrics.openTasks}</strong><small>Click a task to mark it complete</small><div className="progress-track"><i style={{width: `${Math.min(100, metrics.openTasks * 12)}%`}} /></div></article>
            <article className="signal-card"><div className="signal-head"><span>Event pipeline</span><span className="mini-icon blue"><Target /></span></div><strong>₹{metrics.pipelineValue.toLocaleString('en-IN')}</strong><small>Across {opportunities.length} opportunities</small><div className="pipeline-note"><span>{metrics.qualifiedLeads}</span> qualified leads</div></article>
          </section>

          <section className="main-grid">
            <article className="panel action-panel">
              <div className="panel-head"><div><p className="eyebrow">Next best action</p><h2>What needs attention</h2></div><button>View all <ArrowRight /></button></div>
              <div className="action-list">{tasks.filter((task) => task.status === 'open').length ? tasks.filter((task) => task.status === 'open').slice(0,5).map((task) => <button className="action-row" key={task.id} onClick={() => completeTask(task.id)}><span className="initial-avatar">{task.fullName.split(' ').map((word) => word[0]).join('').slice(0,2)}</span><span className="action-copy"><strong>{task.title}</strong><small>{task.fullName} · {task.company}</small></span><span className={`due ${task.dueDate ? 'warning' : 'neutral'}`}>{task.dueDate || 'No date'}</span><Check className="row-arrow" size={17}/></button>) : <div className="empty-state">No open commitments. Capture a lead and add a next action.</div>}</div>
            </article>
            <article className="panel briefing-panel"><div className="ai-label"><Sparkles size={14}/> Morning booth briefing</div><h2>Your team is seeing strong demand for monitoring.</h2><p>SAP integration is the most common concern. Nine promises are still open, and three target accounts have not visited yet.</p><button>Open full briefing <ArrowRight /></button><div className="briefing-orb" aria-hidden="true"><span/><span/><span/></div></article>
          </section>

          <section className="panel leads-panel">
            <div className="panel-head"><div><p className="eyebrow">Live from the booth</p><h2>Recent conversations</h2></div><button>See all leads <ArrowRight /></button></div>
            <div className="lead-table" aria-label="Recent conversations">
              <div className="lead-row lead-header"><span>Person</span><span>Interest</span><span>AI score</span><span>Captured</span></div>
              {capturedLeads.map(lead=><button className="lead-row new-lead" key={lead.id} onClick={() => openReview(lead)}><span className="person-cell"><span className="initial-avatar small">{lead.fullName.split(' ').map(n=>n[0]).join('').slice(0,2)}</span><span><strong>{lead.fullName}</strong><small>{lead.role || 'Role not added'} · {lead.company}</small></span></span><span>{lead.nextAction || 'Needs review'}</span><span><b className={`review-chip ${lead.reviewStatus === 'confirmed' ? 'confirmed' : ''}`}>{lead.reviewStatus === 'confirmed' ? 'Confirmed' : 'Review'}</b></span><span>Just now</span></button>)}
              {recent.map(lead=><button className="lead-row" key={lead.name}><span className="person-cell"><span className="initial-avatar small">{lead.name.split(' ').map(n=>n[0]).join('')}</span><span><strong>{lead.name}</strong><small>{lead.role} · {lead.company}</small></span></span><span>{lead.interest}</span><span><b className={`score ${lead.score>85?'hot':''}`}>{lead.score}</b></span><span>{lead.time}</span></button>)}
            </div>
          </section>
          </> : <section className="section-view">
            <div className="section-title"><div><p className="eyebrow">Revenue workspace</p><h1>{activeView === 'people' ? 'People & accounts' : activeView === 'opportunities' ? 'Opportunities' : activeView === 'rfqs' ? 'RFQs & quotations' : activeView === 'events' ? 'Events' : activeView === 'roi' ? 'Revenue & ROI' : activeView === 'settings' ? 'Workspace settings' : 'Company knowledge'}</h1></div>{activeView === 'opportunities' ? <Button className="capture-button" onClick={() => setOpportunityOpen(true)}><Plus /> New opportunity</Button> : null}</div>
            {activeView === 'people' ? <div className="records-grid"><article className="panel records-panel"><h2>Accounts</h2>{accounts.length ? accounts.map((account) => <button key={account.company} className="record-row"><span className="initial-avatar">{account.company.split(' ').map((word) => word[0]).join('').slice(0,2)}</span><span><strong>{account.company}</strong><small>{account.contacts} contact{account.contacts === 1 ? '' : 's'} captured</small></span><ArrowRight /></button>) : <div className="empty-state">Capture a lead to create the first account.</div>}</article><article className="panel records-panel"><h2>Contacts</h2>{capturedLeads.length ? capturedLeads.map((lead) => <button key={lead.id} className="record-row" onClick={() => openReview(lead)}><span className="initial-avatar">{lead.fullName.split(' ').map((word) => word[0]).join('').slice(0,2)}</span><span><strong>{lead.fullName}</strong><small>{lead.role || 'Role not added'} · {lead.company}</small></span><b className="review-chip">Review</b></button>) : <div className="empty-state">No captured contacts yet.</div>}</article></div> : null}
            {activeView === 'opportunities' ? <article className="panel data-panel">{opportunities.length ? <><div className="data-header"><span>Opportunity</span><span>Stage</span><span>Value</span><span>Probability</span></div>{opportunities.map((item) => <div className="data-row" key={item.id}><span><strong>{item.title}</strong><small>{item.company}</small></span><span className="stage-chip">{item.stage}</span><span>₹{item.value.toLocaleString('en-IN')}</span><span>{item.probability}%</span></div>)}</> : <div className="empty-state large"><Target /><h2>No opportunities yet</h2><p>Convert a qualified conversation into your first pipeline record.</p><Button onClick={() => setOpportunityOpen(true)}>Create opportunity</Button></div>}</article> : null}
            {activeView === 'rfqs' ? <FeatureState icon={FileText} title="RFQ inbox is ready for integration" text="Patch 1 reserves the workflow and database boundary. Document upload, specification extraction, versioning, and quotation approval require secure file storage and arrive in Patch 2." /> : null}
            {activeView === 'events' ? <div className="events-layout">
              <article className="panel event-builder"><div className="settings-heading"><CalendarDays /><div><h2>Prepare an event</h2><p>Configure the booth goal, qualification playbook, routing and follow-up standard before the team arrives.</p></div></div><form className="lead-form" onSubmit={submitEvent}>
                <div className="field-grid"><div className="field-block"><label htmlFor="event-name">Event name</label><Input id="event-name" name="name" required placeholder="IndustrialTech Expo 2027" /></div><div className="field-block"><label htmlFor="event-venue">Venue</label><Input id="event-venue" name="venue" placeholder="Bombay Exhibition Centre" /></div></div>
                <div className="event-three"><div className="field-block"><label htmlFor="event-hall">Hall</label><Input id="event-hall" name="hall" placeholder="2" /></div><div className="field-block"><label htmlFor="event-booth">Booth</label><Input id="event-booth" name="booth" placeholder="B-18" /></div><div className="field-block"><label htmlFor="event-zone">Timezone</label><Input id="event-zone" name="timezone" defaultValue={appContext?.workspace.timezone || 'Asia/Kolkata'} required /></div></div>
                <div className="field-grid"><div className="field-block"><label htmlFor="event-start">Starts</label><Input id="event-start" name="startsOn" type="date" required /></div><div className="field-block"><label htmlFor="event-end">Ends</label><Input id="event-end" name="endsOn" type="date" required /></div></div>
                <div className="field-block"><label htmlFor="event-objective-detail">Business objective</label><Textarea id="event-objective-detail" name="objective" placeholder="Book 30 qualified plant demos and create ₹40L in influenced pipeline." /></div>
                <div className="field-grid"><div className="field-block"><label htmlFor="event-products">Products or services</label><Input id="event-products" name="products" placeholder="MachineSight, Integration assessment" /></div><div className="field-block"><label htmlFor="event-targets">Target accounts</label><Input id="event-targets" name="targetAccounts" placeholder="ABC Pharma, Prime Polymers" /></div></div>
                <div className="field-block"><label htmlFor="event-questions">Qualification questions</label><Textarea id="event-questions" name="qualificationQuestions" placeholder="How many machines?, Which ERP?, When does budget open? (comma separated)" /></div>
                <div className="field-grid"><div className="field-block"><label htmlFor="event-budget">Event budget ({appContext?.workspace.currency || 'INR'})</label><Input id="event-budget" name="budget" type="number" min="0" defaultValue="0" /></div><div className="field-block"><label htmlFor="event-badge">Badge or QR provider</label><Input id="event-badge" name="badgeProvider" placeholder="Manual / provider name" /></div></div>
                <div className="event-three"><div className="field-block"><label htmlFor="event-route">Lead owner</label><select id="event-route" name="leadRoutingRule" defaultValue="capturer"><option value="capturer">Person who captures</option><option value="round_robin">Round robin</option><option value="manager_review">Manager assigns</option></select></div><div className="field-block"><label htmlFor="event-sla">Follow-up SLA (hours)</label><Input id="event-sla" name="followupSlaHours" type="number" min="1" max="720" defaultValue="24" /></div><div className="field-block"><label htmlFor="event-target">Daily lead target</label><Input id="event-target" name="dailyLeadTarget" type="number" min="1" defaultValue="25" /></div></div>
                <div className="field-block"><label htmlFor="event-team">Assigned team members</label><select id="event-team" name="teamMemberIds" multiple size={Math.min(4, Math.max(2, members.length))}>{members.filter((member) => member.status === 'active').map((member) => <option key={member.id} value={member.userId}>{member.displayName || member.email} · {member.role}</option>)}</select><small className="field-help">Hold Ctrl or Command to select more than one person. Empty means the whole workspace can use the event.</small></div>
                <Button className="save-button" type="submit" disabled={!['owner','admin','manager'].includes(appContext?.role || '')}>Create event workspace</Button>
              </form></article>
              <section className="event-list" aria-label="Configured events"><div className="event-list-heading"><div><h2>Configured events</h2><p>Select the event used for new lead captures.</p></div><b>{events.filter((item) => item.status !== 'archived').length} active</b></div>
                {events.length ? events.map((item) => <article className={`panel event-record ${item.id === activeEventId ? 'selected' : ''} ${item.status === 'archived' ? 'archived' : ''}`} key={item.id}><div className="event-record-head"><span className="calendar-tile"><b>{new Date(`${item.startsOn}T00:00:00`).toLocaleDateString('en', { day: '2-digit' })}</b><small>{new Date(`${item.startsOn}T00:00:00`).toLocaleDateString('en', { month: 'short' })}</small></span><span><strong>{item.name}</strong><small>{item.venue || 'Venue pending'}{item.hall ? ` · Hall ${item.hall}` : ''}{item.booth ? ` · Booth ${item.booth}` : ''}</small></span><b className={`event-status ${item.status}`}>{item.status}</b></div><p>{item.objective || 'Business objective not added yet.'}</p><div className="event-meta"><span><small>Dates</small><strong>{item.startsOn} → {item.endsOn}</strong></span><span><small>Budget</small><strong>{appContext?.workspace.currency || 'INR'} {item.budget.toLocaleString()}</strong></span><span><small>Follow-up</small><strong>{item.followupSlaHours}h SLA</strong></span><span><small>QR campaign</small><strong>{item.qrCampaignCode || 'Pending'}</strong></span></div>{item.products.length ? <div className="event-tags">{item.products.map((product) => <span key={product}>{product}</span>)}</div> : null}<div className="event-actions">{item.status !== 'archived' ? <Button type="button" variant={item.id === activeEventId ? 'default' : 'outline'} onClick={() => selectEvent(item.id)}>{item.id === activeEventId ? <><Check /> Active event</> : 'Use for capture'}</Button> : null}<button type="button" onClick={() => eventAction('duplicate', item.id)}>Duplicate</button>{item.status !== 'archived' ? <button className="danger-link" type="button" onClick={() => eventAction('archive', item.id)}>Archive</button> : null}</div></article>) : <article className="panel empty-state large"><CalendarDays /><h2>No event configured</h2><p>Create the first event playbook. It stays in draft until selected for capture.</p></article>}
              </section>
            </div> : null}
            {activeView === 'roi' ? <div className="roi-grid"><article className="panel roi-card"><small>Event investment</small><strong>₹3,00,000</strong><span>Manual baseline</span></article><article className="panel roi-card"><small>Pipeline created</small><strong>₹{metrics.pipelineValue.toLocaleString('en-IN')}</strong><span>{opportunities.length} opportunities</span></article><article className="panel roi-card"><small>Closed revenue</small><strong>₹0</strong><span>No closed opportunities yet</span></article></div> : null}
            {activeView === 'knowledge' ? <div className="knowledge-layout">
              <article className="panel onboarding-progress"><div><span>{knowledge.profile ? '2' : '1'}<small>/4</small></span><div><h2>Company intelligence setup</h2><p>{knowledge.profile ? 'Profile saved. Add products, target customers and evidence.' : 'Start by explaining what the company sells and whom it serves.'}</p></div></div><div className="progress-track"><i style={{ width: `${[knowledge.profile, knowledge.products.length, knowledge.icps.length, knowledge.sources.length].filter(Boolean).length * 25}%` }} /></div></article>
              <article className="panel knowledge-card"><h2>Business profile</h2><form className="lead-form" onSubmit={submitKnowledge}><input type="hidden" name="action" value="save_profile" /><div className="field-grid"><div className="field-block"><label htmlFor="company-legal-name">Company name</label><Input id="company-legal-name" name="legalName" defaultValue={knowledge.profile?.legalName || appContext?.workspace.name} required /></div><div className="field-block"><label htmlFor="company-website">Website</label><Input id="company-website" name="websiteUrl" type="url" defaultValue={knowledge.profile?.websiteUrl} placeholder="https://company.com" /></div></div><div className="field-block"><label htmlFor="company-description">What do you sell?</label><Textarea id="company-description" name="description" defaultValue={knowledge.profile?.description} placeholder="Describe the products, services and customer outcomes." /></div><div className="field-grid"><div className="field-block"><label htmlFor="target-industries">Target industries</label><Input id="target-industries" name="targetIndustries" defaultValue={knowledge.profile?.targetIndustries.join(', ')} placeholder="Pharma, Automotive, Food processing" /></div><div className="field-block"><label htmlFor="target-regions">Target geographies</label><Input id="target-regions" name="targetGeographies" defaultValue={knowledge.profile?.targetGeographies.join(', ')} placeholder="India, GCC, Southeast Asia" /></div></div><div className="field-block"><label htmlFor="event-objective">Primary event objective</label><Input id="event-objective" name="eventObjective" defaultValue={knowledge.profile?.eventObjective} placeholder="Book qualified demos with plant operators" /></div><Button className="save-button" type="submit">Save business profile</Button></form></article>
              <article className="panel knowledge-card"><h2>Products and services</h2><form className="lead-form compact-form" onSubmit={submitKnowledge}><input type="hidden" name="action" value="add_product" /><div className="field-grid"><Input name="name" required placeholder="Product or service name" /><select name="kind" defaultValue="product"><option value="product">Product</option><option value="service">Service</option></select></div><Textarea name="description" placeholder="What it does and the outcome it creates" /><Input name="buyerRoles" placeholder="Buyer roles, comma separated" /><Input name="painPoints" placeholder="Pain points solved, comma separated" /><Button type="submit">Add offering</Button></form><div className="knowledge-records">{knowledge.products.map((item) => <div key={item.id}><span><strong>{item.name}</strong><small>{item.kind} · {item.buyerRoles.join(', ') || 'Buyer roles not added'}</small></span><b>{item.kind}</b></div>)}</div></article>
              <article className="panel knowledge-card"><h2>Ideal customer profile</h2><form className="lead-form compact-form" onSubmit={submitKnowledge}><input type="hidden" name="action" value="add_icp" /><Input name="name" required placeholder="e.g. Multi-site pharmaceutical plants" /><Input name="industries" placeholder="Industries, comma separated" /><Input name="companySizes" placeholder="Company sizes, e.g. 200–5,000 employees" /><Input name="geographies" placeholder="Target regions" /><Input name="buyerRoles" placeholder="Decision-maker roles" /><Textarea name="mustHaveSignals" placeholder="High-value signals, comma separated" /><Textarea name="disqualifiers" placeholder="Disqualifiers, comma separated" /><Button type="submit">Add ideal customer profile</Button></form><div className="knowledge-records">{knowledge.icps.map((item) => <div key={item.id}><span><strong>{item.name}</strong><small>{item.industries.join(', ') || 'Any industry'} · {item.buyerRoles.join(', ') || 'Roles not set'}</small></span><b>ICP</b></div>)}</div></article>
              <article className="panel knowledge-card"><h2>Qualification rules</h2><form className="lead-form compact-form" onSubmit={submitKnowledge}><input type="hidden" name="action" value="add_rule" /><Input name="label" required placeholder="Rule label, e.g. Budget within 6 months" /><div className="field-grid"><select name="field" defaultValue="budget_timing"><option value="budget_timing">Budget timing</option><option value="authority">Authority</option><option value="requirement">Requirement</option><option value="company_size">Company size</option><option value="product_interest">Product interest</option></select><Input name="expectedValue" required placeholder="Expected value" /></div><Input name="weight" type="number" min="-100" max="100" defaultValue="20" /><Button type="submit">Add scoring rule</Button></form><div className="knowledge-records">{knowledge.rules.map((item) => <div key={item.id}><span><strong>{item.label}</strong><small>{item.field.replaceAll('_', ' ')} contains “{item.expectedValue}”</small></span><b className={item.weight < 0 ? 'negative' : ''}>{item.weight > 0 ? '+' : ''}{item.weight}</b></div>)}</div></article>
              <article className="panel knowledge-card knowledge-sources"><h2>Knowledge sources</h2><p>Store approved evidence used to ground future AI answers.</p><div className="source-actions"><label className="upload-control"><FileText />Upload document<input type="file" accept=".pdf,.docx,.xlsx,.csv,.txt,.png,.jpg,.jpeg" onInput={uploadKnowledge} /></label><form onSubmit={submitKnowledge}><input type="hidden" name="action" value="add_url" /><Input name="sourceUrl" type="url" required placeholder="https://company.com/products" /><Button type="submit">Add website</Button></form></div><div className="knowledge-records">{knowledge.sources.map((item) => <div key={item.id}><span><strong>{item.name}</strong><small>{item.sourceType} · {item.status}{item.sizeBytes ? ` · ${Math.ceil(item.sizeBytes / 1024)} KB` : ''}</small></span><b>{item.sourceType}</b></div>)}</div></article>
            </div> : null}
            {activeView === 'settings' ? <div className="settings-layout">
              <article className="panel settings-card workspace-manager"><div className="settings-heading"><Building2 /><div><h2>Your workspaces</h2><p>Switch tenant context or create another trial workspace.</p></div></div><div className="workspace-list">{availableWorkspaces.map((workspace) => <button key={workspace.id} className={workspace.id === appContext?.workspace.id ? 'selected' : ''} onClick={() => switchWorkspace(workspace.id)}><span><strong>{workspace.name}</strong><small>{workspace.role} · {workspace.plan}</small></span>{workspace.id === appContext?.workspace.id ? <Check /> : <ArrowRight />}</button>)}</div><form className="invite-form" onSubmit={createWorkspace}><Input name="name" placeholder="New company workspace" required /><Input name="timezone" value={appContext?.workspace.timezone || 'Asia/Kolkata'} readOnly /><Button type="submit">Create</Button></form></article>
              <article className="panel settings-card"><div className="settings-heading"><ShieldCheck /><div><h2>Workspace identity</h2><p>Tenant-specific defaults used by dates, reports and revenue.</p></div></div><form className="lead-form" onSubmit={saveSettings}><div className="field-block"><label htmlFor="workspace-name">Workspace name</label><Input id="workspace-name" name="name" key={appContext?.workspace.id} defaultValue={appContext?.workspace.name} required /></div><div className="field-grid"><div className="field-block"><label htmlFor="workspace-timezone">Timezone</label><Input id="workspace-timezone" name="timezone" defaultValue={appContext?.workspace.timezone} required /></div><div className="field-block"><label htmlFor="workspace-currency">Currency</label><Input id="workspace-currency" name="currency" defaultValue={appContext?.workspace.currency} maxLength={3} required /></div></div><div className="settings-actions"><Button className="save-button" type="submit" disabled={!['owner','admin'].includes(appContext?.role || '')}>Save workspace</Button><Button type="button" variant="outline" onClick={exportWorkspace}>Export data</Button></div></form></article>
              <article className="panel settings-card"><div className="settings-heading"><UserPlus /><div><h2>Invite a teammate</h2><p>Invitations expire after seven days. Trial limit: three active members.</p></div></div><form className="invite-form" onSubmit={inviteMember}><Input name="email" type="email" placeholder="teammate@company.com" required /><select name="role" defaultValue="salesperson"><option value="admin">Administrator</option><option value="manager">Manager</option><option value="salesperson">Salesperson</option><option value="marketing">Marketing</option><option value="viewer">Viewer</option></select><Button type="submit" disabled={!['owner','admin'].includes(appContext?.role || '')}>Invite</Button></form><div className="member-list"><h3>Members</h3>{members.map((member) => <div key={member.id}><span className="profile-avatar">{member.email.slice(0,2).toUpperCase()}</span><span><strong>{member.displayName || member.email}</strong><small>{member.email}</small></span>{member.role === 'owner' ? <b>owner</b> : <span className="member-controls"><select aria-label={`Role for ${member.email}`} value={member.role} onChange={(event) => updateMember(member.id, event.target.value, member.status)}><option value="admin">Admin</option><option value="manager">Manager</option><option value="salesperson">Sales</option><option value="marketing">Marketing</option><option value="viewer">Viewer</option></select><button onClick={() => updateMember(member.id, member.role, member.status === 'active' ? 'inactive' : 'active')} type="button">{member.status === 'active' ? 'Deactivate' : 'Activate'}</button></span>}</div>)}{invitations.map((invite) => <div key={invite.id} className="pending-member"><span className="profile-avatar">?</span><span><strong>{invite.email}</strong><small>Invitation pending · {invite.role}</small></span><button type="button" onClick={() => revokeInvitation(invite.id)}>Revoke</button></div>)}</div></article>
              <article className="panel settings-card audit-card"><div className="settings-heading"><FileText /><div><h2>Recent security activity</h2><p>Important workspace actions are permanently attributed.</p></div></div>{auditEvents.length ? auditEvents.map((item) => <div className="audit-row" key={item.id}><span>{item.action.replaceAll('.', ' ')}</span><small>{item.entityType} · {new Date(item.createdAt).toLocaleString()}</small></div>) : <div className="empty-state">No recorded workspace changes yet.</div>}</article>
            </div> : null}
          </section>}
        </div>
        {notice ? <output className="toast">{notice}</output> : null}
      </section>
      <Dialog open={searchOpen} onOpenChange={setSearchOpen}><DialogContent className="search-dialog"><DialogHeader><DialogTitle>Search workspace</DialogTitle><DialogDescription>Find a contact, account, task, or opportunity.</DialogDescription></DialogHeader><Input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Type a name, company, or action…" /><div className="search-results">{searchTerm.trim() ? [...capturedLeads.map((lead) => ({ label: lead.fullName, meta: lead.company, action: () => { setSearchOpen(false); openReview(lead); } })), ...tasks.map((task) => ({ label: task.title, meta: `${task.fullName} · ${task.company}`, action: () => { setSearchOpen(false); go('today'); } })), ...opportunities.map((item) => ({ label: item.title, meta: item.company, action: () => { setSearchOpen(false); go('opportunities'); } }))].filter((item) => `${item.label} ${item.meta}`.toLowerCase().includes(searchTerm.toLowerCase())).slice(0,8).map((item) => <button key={`${item.label}-${item.meta}`} onClick={item.action}><Search /><span><strong>{item.label}</strong><small>{item.meta}</small></span></button>) : <div className="empty-state">Start typing to search the current workspace.</div>}</div></DialogContent></Dialog>
      <Dialog open={opportunityOpen} onOpenChange={setOpportunityOpen}><DialogContent className="capture-dialog"><DialogHeader><DialogTitle>Create opportunity</DialogTitle><DialogDescription>Add a qualified deal to the event pipeline.</DialogDescription></DialogHeader><form className="lead-form" onSubmit={createOpportunity}><div className="field-block"><label htmlFor="opp-company">Company</label><Input id="opp-company" name="company" required placeholder="ABC Pharma" /></div><div className="field-block"><label htmlFor="opp-title">Opportunity</label><Input id="opp-title" name="title" required placeholder="Machine monitoring rollout" /></div><div className="field-grid"><div className="field-block"><label htmlFor="opp-value">Estimated value (₹)</label><Input id="opp-value" name="value" type="number" min="0" placeholder="1200000" /></div><div className="field-block"><label htmlFor="opp-close">Expected close</label><Input id="opp-close" name="expectedCloseDate" type="date" /></div></div><Button className="save-button" type="submit">Create opportunity</Button></form></DialogContent></Dialog>
    </main>
  );
}
