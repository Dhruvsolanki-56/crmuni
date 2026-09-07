'use client';

import { useEffect, useRef, useState, type SyntheticEvent } from 'react';
import {
  ArrowRight, BarChart3, Building2, CalendarDays, Camera, Check, ChevronDown,
  CircleUserRound, Clock3, FileText, LayoutDashboard, Menu, Mic, Plus, QrCode,
  Search, Sparkles, Square, Target, Users, Wifi,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

const actions = [
  { name: 'Rajesh Mehta', company: 'ABC Pharma', action: 'Send architecture + preliminary pricing', due: 'Due today', tone: 'urgent', avatar: 'RM' },
  { name: 'Neha Shah', company: 'ABC Pharma', action: 'Schedule SAP integration demo', due: 'Tomorrow', tone: 'warning', avatar: 'NS' },
  { name: 'Vikram Jain', company: 'Helix Engineering', action: 'Follow up on Sample X feedback', due: 'Sep 9', tone: 'neutral', avatar: 'VJ' },
];

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

function NavItem({ icon: Icon, label, active = false }: { icon: typeof LayoutDashboard; label: string; active?: boolean }) {
  return <button className={`nav-item ${active ? 'nav-item-active' : ''}`} type="button"><Icon size={18} strokeWidth={1.8} /><span>{label}</span></button>;
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
  const [attachment, setAttachment] = useState<{ name: string; url: string; kind: 'card' | 'badge' | 'audio' } | null>(null);
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

  useEffect(() => {
    fetch('/api/leads').then(async (response) => {
      if (!response.ok) return;
      const data = await response.json() as { leads?: SavedLead[] };
      setCapturedLeads(data.leads || []);
    }).catch(() => undefined);
  }, []);

  async function saveLead(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setSaveError('');
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());
    try {
      const response = await fetch('/api/leads', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await response.json() as { lead?: SavedLead; error?: string };
      if (!response.ok || !data.lead) throw new Error(data.error || 'Unable to save this lead.');
      setSavedLead(data.lead); setCapturedLeads((current) => [data.lead!, ...current]); setSaved(true);
    } catch (error) { setSaveError(error instanceof Error ? error.message : 'Unable to save this lead.'); }
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
    setAttachment({ name: file.name, url: URL.createObjectURL(file), kind });
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
        setAttachment({ name: `conversation-${Date.now()}.webm`, url: URL.createObjectURL(blob), kind: 'audio' });
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
      const response = await fetch('/api/analysis', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ leadId: reviewLead.id }) });
      const data = await response.json() as { analysis?: Analysis; extractionId?: string; error?: string };
      if (!response.ok || !data.analysis || !data.extractionId) throw new Error(data.error || 'Unable to analyze this conversation.');
      setAnalysis(data.analysis); setExtractionId(data.extractionId);
    } catch (error) { setAnalysisError(error instanceof Error ? error.message : 'Unable to analyze this conversation.'); }
    finally { setAnalyzing(false); }
  }

  async function confirmAnalysis() {
    const response = await fetch('/api/analysis/confirm', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ extractionId }) });
    if (response.ok) { setConfirmed(true); setCapturedLeads((current) => current.map((lead) => lead.id === reviewLead?.id ? { ...lead, reviewStatus: 'confirmed' } : lead)); }
    else setAnalysisError('Could not confirm this analysis. Please try again.');
  }

  return (
    <main className="app-shell">
      <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
        <div className="brand"><span className="brand-mark"><Sparkles size={18} /></span><span>Revenue OS</span></div>
        <div className="workspace-switcher"><span className="workspace-logo">NA</span><span><strong>Nova Automation</strong><small>Growth workspace</small></span><ChevronDown size={15} /></div>
        <nav aria-label="Main navigation">
          <p className="nav-label">Workspace</p>
          <NavItem icon={LayoutDashboard} label="Today" active />
          <NavItem icon={Users} label="People & accounts" />
          <NavItem icon={Target} label="Opportunities" />
          <NavItem icon={FileText} label="RFQs & quotations" />
          <p className="nav-label nav-label-spaced">Manage</p>
          <NavItem icon={CalendarDays} label="Events" />
          <NavItem icon={BarChart3} label="Revenue & ROI" />
          <NavItem icon={Building2} label="Company knowledge" />
        </nav>
        <div className="sidebar-foot">
          <div className="sync-state"><Wifi size={15} /><span>Online · All synced</span></div>
          <div className="profile-row"><span className="profile-avatar">AS</span><span><strong>Arjun Singh</strong><small>Sales manager</small></span></div>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setMobileNav(!mobileNav)} aria-label="Toggle navigation"><Menu /></button>
          <div className="event-context"><span className="live-dot" /> IndustrialTech Expo 2026 <span>· Day 1</span></div>
          <div className="topbar-actions"><button className="search-button" aria-label="Search"><Search size={17} /><span>Search</span><kbd>⌘ K</kbd></button><button className="icon-button" aria-label="Profile"><CircleUserRound size={21} /></button></div>
        </header>

        <div className="content">
          <section className="welcome-row">
            <div><p className="eyebrow">Sunday, 6 September</p><h1>Good afternoon, Arjun.</h1><p className="subtle">Three commitments need your attention today.</p></div>
            <Dialog open={captureOpen} onOpenChange={resetCapture}>
              <DialogTrigger render={<Button className="capture-button" />}><Plus size={19} strokeWidth={2.4} /> Capture lead</DialogTrigger>
              <DialogContent className="capture-dialog" showCloseButton={!saved}>
                {!saved ? <>
                  <DialogHeader><p className="dialog-kicker">IndustrialTech Expo · Day 1</p><DialogTitle className="dialog-title">Capture a new conversation</DialogTitle><DialogDescription>Start with whatever the visitor gives you. Add the conversation immediately after.</DialogDescription></DialogHeader>
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
                    <div className="field-block"><label htmlFor="lead-note">Conversation note</label><Textarea id="lead-note" name="note" placeholder="What did they need, what did you promise, and when?" /></div>
                    <div className="field-grid"><div className="field-block"><label htmlFor="lead-action">Next action</label><Input id="lead-action" name="nextAction" placeholder="e.g. Send preliminary pricing" /></div><div className="field-block"><label htmlFor="lead-due">Due date</label><Input id="lead-due" name="dueDate" type="date" /></div></div>
                    {saveError ? <p className="form-error" role="alert">{saveError}</p> : null}
                    <button className="sample-button" type="button" onClick={useSampleLead}>Fill test conversation</button>
                    <Button type="submit" className="save-button" disabled={saving}>{saving ? 'Saving securely…' : 'Save conversation'} {!saving && <ArrowRight />}</Button>
                    <p className="offline-note"><Wifi size={14} /> Works offline. We’ll sync when your connection returns.</p>
                  </form>
                </> : <div className="success-state"><span className="success-icon"><Check /></span><p className="dialog-kicker">Lead saved</p><DialogTitle className="dialog-title">{savedLead?.fullName} is ready for review</DialogTitle><DialogDescription>The conversation is stored as source evidence. AI extraction will be added next; no facts have been invented.</DialogDescription><div className="saved-summary"><span><small>Account</small><strong>{savedLead?.company}</strong></span><span><small>Review</small><strong>Needs review</strong></span>{savedLead?.nextAction ? <span><small>Commitment</small><strong>{savedLead.nextAction}</strong></span> : null}{savedLead?.dueDate ? <span><small>Due</small><strong>{savedLead.dueDate}</strong></span> : null}</div><Button className="save-button" onClick={() => resetCapture(false)}>Back to today</Button></div>}
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
            <article className="signal-card primary-signal"><div className="signal-head"><span>Captured today</span><span className="trend">+18%</span></div><strong>246</strong><small>31 high-intent conversations</small><div className="spark-bars" aria-hidden="true">{[32,44,37,58,49,70,63,82,76,91].map((h,i)=><i key={i} style={{height:`${h}%`}} />)}</div></article>
            <article className="signal-card"><div className="signal-head"><span>Open promises</span><span className="mini-icon amber"><Clock3 /></span></div><strong>9</strong><small>3 due before end of day</small><div className="progress-track"><i style={{width:'64%'}} /></div></article>
            <article className="signal-card"><div className="signal-head"><span>Event pipeline</span><span className="mini-icon blue"><Target /></span></div><strong>₹42L</strong><small>Across 8 opportunities</small><div className="pipeline-note"><span>₹12L</span> newly qualified today</div></article>
          </section>

          <section className="main-grid">
            <article className="panel action-panel">
              <div className="panel-head"><div><p className="eyebrow">Next best action</p><h2>What needs attention</h2></div><button>View all <ArrowRight /></button></div>
              <div className="action-list">{actions.map(item=><button className="action-row" key={item.name}><span className="initial-avatar">{item.avatar}</span><span className="action-copy"><strong>{item.action}</strong><small>{item.name} · {item.company}</small></span><span className={`due ${item.tone}`}>{item.due}</span><ArrowRight className="row-arrow" size={17}/></button>)}</div>
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
        </div>
      </section>
    </main>
  );
}
