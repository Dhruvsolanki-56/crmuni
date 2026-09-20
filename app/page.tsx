'use client';

import { useEffect, useRef, useState, type SyntheticEvent } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Building2,
  CalendarDays,
  Camera,
  Check,
  ChevronDown,
  CircleUserRound,
  Clock3,
  FileText,
  LayoutDashboard,
  Menu,
  Mic,
  Plus,
  QrCode,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Square,
  Target,
  Trash2,
  UserPlus,
  Users,
  Wifi,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  classifyCaptureResponse,
  nextCaptureRetry,
} from '@/lib/offline-capture';

type SavedLead = {
  id: string;
  eventId?: string;
  fullName: string;
  company: string;
  role?: string;
  note?: string;
  email?: string;
  phone?: string;
  buyingRole?: string;
  nextAction?: string;
  dueDate?: string;
  reviewStatus: string;
  createdAt: number;
  assetId?: string;
  captureKind?: string;
  captureStatus?: string;
  extractedJson?: string;
  score?: number;
  scoreRationale?: string;
  emailConsentStatus?: string;
  whatsappConsentStatus?: string;
  duplicateLeadId?: string;
  duplicateLeadName?: string;
  duplicateLeadCompany?: string;
  qualificationState?: string;
  qualificationReason?: string;
  ownerId?: string;
  ownerName?: string;
};

type CaptureExtraction = {
  fullName: string | null;
  company: string | null;
  role: string | null;
  email: string | null;
  phone: string | null;
  transcript: string | null;
  confidence: number;
  fieldConfidence?: Partial<
    Record<
      'fullName' | 'company' | 'role' | 'email' | 'phone' | 'transcript',
      number
    >
  >;
  warnings: string[];
};

type Analysis = {
  summary: string;
  fields: Array<{
    key: string;
    label: string;
    value: string | null;
    confidence: number;
    evidence: string | null;
  }>;
  commitments: Array<{
    title: string;
    due_date: string | null;
    owner_party: string;
    confidence: number;
    evidence: string;
  }>;
  score: { value: number; rationale: string };
  risks: string[];
};

type TaskItem = {
  id: string;
  leadId: string;
  title: string;
  dueDate?: string;
  status: string;
  fullName: string;
  company: string;
  version: number;
  reminderAt?: number;
  completedAt?: number;
  cancelledAt?: number;
  cancellationReason?: string;
};
type MeetingItem = {
  id: string;
  eventId: string;
  leadId?: string;
  title: string;
  startsAt: number;
  endsAt: number;
  timezone: string;
  location?: string;
  agenda?: string;
  status: string;
  cancellationReason?: string;
  version: number;
  leadName?: string;
  company?: string;
  participantCount: number;
};
type OpportunityContact = {
  leadId: string;
  fullName: string;
  company: string;
  buyingRole?: string;
  contactRole?: string;
  isPrimary?: number;
};
type Opportunity = {
  id: string;
  eventId?: string;
  leadId?: string;
  company: string;
  title: string;
  stage: string;
  value: number;
  currency: string;
  probability: number;
  expectedCloseDate?: string;
  lossReason?: string;
  closedAt?: number;
  version: number;
  contacts: OpportunityContact[];
};
type Account = {
  id: string;
  company: string;
  contacts: number;
  latestAt: number;
  stakeholders: number;
};
type View =
  | 'today'
  | 'people'
  | 'opportunities'
  | 'rfqs'
  | 'meetings'
  | 'events'
  | 'roi'
  | 'knowledge'
  | 'settings';
type AppContext = {
  workspace: {
    id: string;
    name: string;
    slug: string;
    timezone: string;
    currency: string;
    plan: string;
    status: string;
  };
  role: string;
  user: { id: string; email: string };
};
type Member = {
  id: string;
  userId: string;
  email?: string;
  displayName?: string;
  role: string;
  status: string;
};
type Invitation = {
  id: string;
  email: string;
  role: string;
  status: string;
  expiresAt: number;
};
type SupportGrant = {
  id: string;
  supportUserId: string;
  supportEmail: string;
  reason: string;
  ticketReference?: string;
  status: string;
  expiresAt: number;
  lastAccessAt?: number;
  createdAt: number;
};
type AuditEvent = {
  id: string;
  action: string;
  entityType: string;
  createdAt: number;
};
type WorkspaceUsage = {
  leads: number;
  activeEvents: number;
  knowledgeSources: number;
  storageBytes: number;
  activeMembers: number;
};
type PlanEntitlements = {
  plan: string;
  activeMembers: number;
  storageBytes: number;
  aiRequestsPerMinute: number;
};
type LeadMerge = {
  id: string;
  sourceLeadId: string;
  targetLeadId: string;
  sourceName: string;
  targetName: string;
  mergedAt: number;
};
type DeletionRequest = {
  id: string;
  status: string;
  scheduledFor: number;
  createdAt: number;
};
type OperationsData = {
  health: {
    status: string;
    jobsByStatus: Record<string, number>;
    lastRun?: {
      startedAt: number;
      finishedAt?: number;
      completedCount: number;
      failedCount: number;
      deadCount: number;
    };
  };
  jobs: Array<{
    id: string;
    kind: string;
    status: string;
    attempts: number;
    maxAttempts: number;
    availableAt: number;
    lastError?: string;
  }>;
  alerts: Array<{
    id: string;
    severity: string;
    code: string;
    message: string;
    status: string;
    createdAt: number;
  }>;
  notifications: Array<{
    id: string;
    title: string;
    body: string;
    readAt?: number;
    createdAt: number;
  }>;
};
type KnowledgeData = {
  profile: null | {
    legalName: string;
    websiteUrl?: string;
    description?: string;
    targetIndustries: string[];
    targetGeographies: string[];
    eventObjective?: string;
    onboardingStep: number;
  };
  products: Array<{
    id: string;
    name: string;
    kind: string;
    description?: string;
    buyerRoles: string[];
    painPoints: string[];
  }>;
  icps: Array<{
    id: string;
    name: string;
    industries: string[];
    buyerRoles: string[];
    mustHaveSignals: string[];
    disqualifiers: string[];
  }>;
  rules: Array<{
    id: string;
    label: string;
    field: string;
    expectedValue: string;
    weight: number;
  }>;
  sources: Array<{
    id: string;
    name: string;
    sourceType: string;
    sourceUrl?: string;
    contentType?: string;
    sizeBytes?: number;
    status: string;
    contentHash?: string;
    extractionMethod?: string;
    ingestionStatus?: string;
    attempts?: number;
    lastError?: string;
    reviewNote?: string;
    reviewedBy?: string;
    reviewedAt?: number;
  }>;
  claims: Array<{
    id: string;
    claimText: string;
    evidenceNote?: string;
    sourceId?: string;
    sourceName?: string;
    status: string;
    version: number;
    approvedBy?: string;
    approvedAt?: number;
    createdAt: number;
  }>;
  profileVersions: Array<{
    id: string;
    version: number;
    snapshot: Record<string, unknown>;
    changeReason: string;
    createdBy: string;
    createdAt: number;
  }>;
};
type EventItem = {
  id: string;
  name: string;
  venue?: string;
  hall?: string;
  booth?: string;
  startsOn: string;
  endsOn: string;
  timezone: string;
  budget: number;
  attributionWindowDays: number;
  grossMarginBps: number;
  objective?: string;
  products: string[];
  targetAccounts: string[];
  qualificationQuestions: string[];
  leadRoutingRule: string;
  followupSlaHours: number;
  dailyLeadTarget: number;
  badgeProvider?: string;
  qrCampaignCode?: string;
  configVersion: number;
  status: string;
  readinessVersion?: number;
  readinessStatus?: string;
  readinessChecks: Array<{
    key: string;
    label: string;
    passed: boolean;
    detail: string;
    required: boolean;
  }>;
  configHash?: string;
  assessedAt?: number;
  activatedAt?: number;
  deviceConfig?: Record<string, unknown>;
};
type EventCost = {
  id: string;
  eventId: string;
  category: string;
  description: string;
  vendor?: string;
  amount: number;
  status: string;
  incurredOn?: string;
  version: number;
};
type RevenueReport = {
  attributionModel: string;
  attributionWindowDays: number | null;
  totalLeads: number;
  qualifiedLeads: number;
  openOpportunities: number;
  pipelineValue: number;
  weightedPipelineValue: number;
  wonOpportunities: number;
  closedRevenue: number;
  plannedInvestment: number;
  plannedCostLines: number;
  actualInvestment: number;
  investmentBasis: number;
  investmentBasisSource: string;
  grossProfit: number;
  revenueRoiPercent: number | null;
  profitRoiPercent: number | null;
  reconciliation: {
    acceptedQuotationValue: number;
    wonWithoutAcceptedQuotation: number;
    acceptedQuotationWithoutWonOpportunity: number;
    excludedOutsideAttributionWindow: number;
  };
};
type NextBestAction = {
  id: string;
  kind: string;
  title: string;
  subject: string;
  priority: number;
  reason: string;
  dueAt?: number;
};
type FollowupDraft = {
  id: string;
  channel: string;
  recipient: string;
  subject?: string;
  body: string;
  status: string;
  model: string;
  version: number;
  createdAt: number;
  updatedAt?: number;
};
type RfqExtraction = {
  deliveryLocation: string | null;
  submissionDeadline: string | null;
  summary: string;
  items: Array<{
    product: string;
    quantity: string | null;
    specifications: string | null;
    evidence: string;
  }>;
  warnings: string[];
};
type RfqItem = {
  id: string;
  title: string;
  reference?: string;
  requesterCompany: string;
  contactName?: string;
  deliveryLocation?: string;
  submissionDeadline?: string;
  status: string;
  processingStatus: string;
  ownerId: string;
  ownerName?: string;
  ownerDueAt?: number;
  version: number;
  submissionCount: number;
  latestSubmissionNote?: string;
  clarificationNote?: string;
  itemCount: number;
  documentCount: number;
  extractionId?: string;
  extractionStatus?: string;
  extractionJson?: string;
  createdAt: number;
};
type Quotation = {
  id: string;
  rfqId?: string;
  opportunityId?: string;
  quoteNumber: string;
  customer: string;
  amount: number;
  currency: string;
  validUntil?: string;
  status: string;
  version: number;
  revisionCount: number;
  approvedBy?: string;
  approvedAt?: number;
  sentAt?: number;
  hasDocument: boolean;
  originalName?: string;
  createdAt: number;
};
type OfflineCapture = {
  id: string;
  workspaceId: string;
  eventId: string;
  fields: Record<string, string>;
  attachment?: File;
  attachmentKind?: string;
  queuedAt: number;
  status: 'queued' | 'retrying' | 'needs_review';
  attempts: number;
  lastAttemptAt?: number;
  nextAttemptAt: number;
  lastError?: string;
};

function openOutbox() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('revenue-os-offline', 2);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains('captures'))
        request.result.createObjectStore('captures', { keyPath: 'id' });
      if (!request.result.objectStoreNames.contains('event-configs'))
        request.result.createObjectStore('event-configs', { keyPath: 'key' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function sha256Text(value: string) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(digest)]
    .map((item) => item.toString(16).padStart(2, '0'))
    .join('');
}

async function cacheEventConfig(workspaceId: string, event: EventItem) {
  if (!event.deviceConfig || !event.configHash)
    throw new Error('Event readiness snapshot is missing.');
  const configJson = JSON.stringify(event.deviceConfig);
  if ((await sha256Text(configJson)) !== event.configHash)
    throw new Error('Event configuration integrity check failed.');
  const db = await openOutbox();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction('event-configs', 'readwrite');
    transaction.objectStore('event-configs').put({
      key: `${workspaceId}:${event.id}`,
      workspaceId,
      eventId: event.id,
      configVersion: event.configVersion,
      readinessVersion: event.readinessVersion,
      configHash: event.configHash,
      config: event.deviceConfig,
      event: { ...event, status: 'active' },
      cachedAt: Date.now(),
    });
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
}

async function cachedEvents(workspaceId: string) {
  if (!workspaceId) return [];
  const db = await openOutbox();
  const rows = await new Promise<
    Array<{ workspaceId: string; event: EventItem }>
  >((resolve, reject) => {
    const request = db
      .transaction('event-configs')
      .objectStore('event-configs')
      .getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return rows
    .filter((row) => row.workspaceId === workspaceId && row.event)
    .map((row) => row.event);
}

async function clearWorkspaceOfflineData(workspaceId: string) {
  if (!workspaceId) return;
  const db = await openOutbox();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(
      ['captures', 'event-configs'],
      'readwrite',
    );
    for (const storeName of ['captures', 'event-configs']) {
      const store = transaction.objectStore(storeName);
      const request = store.getAll();
      request.onsuccess = () => {
        for (const row of request.result as Array<{
          id?: string;
          key?: string;
          workspaceId?: string;
        }>) {
          if (row.workspaceId !== workspaceId) continue;
          const key = storeName === 'captures' ? row.id : row.key;
          if (key) store.delete(key);
        }
      };
    }
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
}

async function outboxWrite(
  value: OfflineCapture | string,
  mode: 'put' | 'delete',
) {
  const db = await openOutbox();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction('captures', 'readwrite');
    const store = transaction.objectStore('captures');
    if (mode === 'put') store.put(value as OfflineCapture);
    else store.delete(value as string);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
}

async function outboxItems() {
  const db = await openOutbox();
  const items = await new Promise<OfflineCapture[]>((resolve, reject) => {
    const request = db.transaction('captures').objectStore('captures').getAll();
    request.onsuccess = () => resolve(request.result as OfflineCapture[]);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return items;
}

function NavItem({
  icon: Icon,
  label,
  active = false,
  onClick,
}: {
  icon: typeof LayoutDashboard;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`nav-item ${active ? 'nav-item-active' : ''}`}
      onClick={onClick}
      type="button"
    >
      <Icon size={18} strokeWidth={1.8} />
      <span>{label}</span>
    </button>
  );
}

function apiFetch(path: string, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  const workspaceId = window.localStorage.getItem('revenue-workspace-id');
  if (workspaceId) headers.set('x-revenue-workspace-id', workspaceId);
  const eventId = window.localStorage.getItem('revenue-event-id');
  if (eventId) headers.set('x-revenue-event-id', eventId);
  return fetch(path, { ...init, headers });
}

function money(value: number, currency = 'INR') {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString()}`;
  }
}
function rfqExtraction(value?: string) {
  try {
    return value ? (JSON.parse(value) as RfqExtraction) : null;
  } catch {
    return null;
  }
}
function captureExtraction(value?: string) {
  try {
    return value ? (JSON.parse(value) as CaptureExtraction) : null;
  } catch {
    return null;
  }
}
function dueStatus(dueDate: string | undefined, timezone: string) {
  if (!dueDate) return { label: 'No date', tone: 'neutral' };
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const read = (type: string) =>
    parts.find((part) => part.type === type)?.value || '';
  const today = `${read('year')}-${read('month')}-${read('day')}`;
  if (dueDate < today) return { label: `Overdue · ${dueDate}`, tone: 'urgent' };
  if (dueDate === today) return { label: 'Due today', tone: 'warning' };
  return { label: dueDate, tone: 'neutral' };
}

export default function Home() {
  const [captureOpen, setCaptureOpen] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [captureProgress, setCaptureProgress] = useState('');
  const [saveError, setSaveError] = useState('');
  const [captureOutcome, setCaptureOutcome] = useState('');
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
  const [showAllTasks, setShowAllTasks] = useState(false);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [leadMerges, setLeadMerges] = useState<LeadMerge[]>([]);
  const [metrics, setMetrics] = useState({
    totalLeads: 0,
    qualifiedLeads: 0,
    openTasks: 0,
    pipelineValue: 0,
  });
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [opportunityOpen, setOpportunityOpen] = useState(false);
  const [opportunityLead, setOpportunityLead] = useState<SavedLead | null>(
    null,
  );
  const [notice, setNotice] = useState('');
  const [clockNow, setClockNow] = useState(0);
  const [appContext, setAppContext] = useState<AppContext | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [supportGrants, setSupportGrants] = useState<SupportGrant[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [availableWorkspaces, setAvailableWorkspaces] = useState<
    Array<AppContext['workspace'] & { role: string }>
  >([]);
  const [workspaceUsage, setWorkspaceUsage] = useState<WorkspaceUsage>({
    leads: 0,
    activeEvents: 0,
    knowledgeSources: 0,
    storageBytes: 0,
    activeMembers: 0,
  });
  const [planEntitlements, setPlanEntitlements] = useState<PlanEntitlements>({
    plan: 'trial',
    activeMembers: 3,
    storageBytes: 100 * 1024 * 1024,
    aiRequestsPerMinute: 20,
  });
  const [capabilities, setCapabilities] = useState({ aiConfigured: false });
  const [deletionRequest, setDeletionRequest] =
    useState<DeletionRequest | null>(null);
  const [operations, setOperations] = useState<OperationsData | null>(null);
  const [settingsLoadedAt, setSettingsLoadedAt] = useState(0);
  const [knowledge, setKnowledge] = useState<KnowledgeData>({
    profile: null,
    products: [],
    icps: [],
    rules: [],
    sources: [],
    claims: [],
    profileVersions: [],
  });
  const [events, setEvents] = useState<EventItem[]>([]);
  const [revenueReport, setRevenueReport] = useState<RevenueReport | null>(
    null,
  );
  const [eventCosts, setEventCosts] = useState<EventCost[]>([]);
  const [nextBestActions, setNextBestActions] = useState<NextBestAction[]>([]);
  const [activeEventId, setActiveEventId] = useState(() =>
    typeof window === 'undefined'
      ? ''
      : window.localStorage.getItem('revenue-event-id') || '',
  );
  const [outboxCount, setOutboxCount] = useState(0);
  const [outboxNeedsReview, setOutboxNeedsReview] = useState(0);
  const [followups, setFollowups] = useState<FollowupDraft[]>([]);
  const [meetings, setMeetings] = useState<MeetingItem[]>([]);
  const [drafting, setDrafting] = useState('');
  const [extractingCapture, setExtractingCapture] = useState(false);
  const [acceptedCaptureFields, setAcceptedCaptureFields] = useState<string[]>(
    [],
  );
  const [rfqs, setRfqs] = useState<RfqItem[]>([]);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [processingRfq, setProcessingRfq] = useState('');
  const [attachment, setAttachment] = useState<{
    name: string;
    url: string;
    kind: 'card' | 'badge' | 'qr' | 'audio';
    file: File;
  } | null>(null);
  const [recording, setRecording] = useState(false);
  const cardInput = useRef<HTMLInputElement>(null);
  const badgeInput = useRef<HTMLInputElement>(null);
  const qrInput = useRef<HTMLInputElement>(null);
  const leadForm = useRef<HTMLFormElement>(null);
  const reviewContactForm = useRef<HTMLFormElement>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);

  useEffect(() => {
    const context = (
      document as Document & {
        modelContext?: {
          registerTool: (
            tool: unknown,
            options?: { signal?: AbortSignal },
          ) => void | Promise<void>;
        };
      }
    ).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const toolEvent =
      events.find((item) => item.id === activeEventId)?.name ||
      'No active event';
    const register = context.registerTool(
      {
        name: 'start_lead_capture',
        title: 'Start lead capture',
        description:
          'Open the lead capture flow for the active exhibition event.',
        inputSchema: {
          type: 'object',
          properties: {},
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute: () => {
          setCaptureOpen(true);
          return { status: 'capture_open', event: toolEvent };
        },
      },
      { signal: lifecycle.signal },
    );
    void Promise.resolve(register).catch(() => undefined);
    return () => lifecycle.abort();
  }, [activeEventId, events]);

  async function loadWorkspace() {
    try {
      const response = await apiFetch('/api/workspace');
      if (!response.ok) return;
      const data = (await response.json()) as {
        context?: AppContext;
        leads?: SavedLead[];
        tasks?: TaskItem[];
        opportunities?: Opportunity[];
        accounts?: Account[];
        merges?: LeadMerge[];
        metrics?: typeof metrics;
      };
      setCapturedLeads(data.leads || []);
      setTasks(data.tasks || []);
      setOpportunities(data.opportunities || []);
      setAccounts(data.accounts || []);
      setLeadMerges(data.merges || []);
      if (data.context) setAppContext(data.context);
      if (data.metrics) setMetrics(data.metrics);
    } catch {
      // Offline event capture can continue from its verified device cache.
    }
  }
  async function loadEvents() {
    try {
      const response = await apiFetch('/api/events');
      if (response.ok) {
        const data = (await response.json()) as { events: EventItem[] };
        setEvents(data.events);
        const selected = window.localStorage.getItem('revenue-event-id');
        if (selected) {
          const selectedEvent = data.events.find(
            (item) => item.id === selected && item.status === 'active',
          );
          if (!selectedEvent) {
            window.localStorage.removeItem('revenue-event-id');
            setActiveEventId('');
          } else {
            const workspaceId =
              window.localStorage.getItem('revenue-workspace-id') || '';
            try {
              await cacheEventConfig(workspaceId, selectedEvent);
            } catch {
              window.localStorage.removeItem('revenue-event-id');
              setActiveEventId('');
              setNotice(
                'Event configuration verification failed. Select it again.',
              );
            }
          }
        }
        return;
      }
    } catch {
      const workspaceId =
        window.localStorage.getItem('revenue-workspace-id') || '';
      const cached = await cachedEvents(workspaceId).catch(() => []);
      if (cached.length) setEvents(cached);
    }
  }
  async function loadReports() {
    const response = await apiFetch('/api/reports');
    if (!response.ok) return;
    const data = (await response.json()) as {
      report: RevenueReport;
      costs: EventCost[];
      nextBestActions: NextBestAction[];
    };
    setRevenueReport(data.report);
    setEventCosts(data.costs || []);
    setNextBestActions(data.nextBestActions || []);
  }
  async function loadSettings() {
    const response = await apiFetch('/api/settings');
    if (!response.ok) return;
    const data = (await response.json()) as {
      context: AppContext;
      serverTime: number;
      members: Member[];
      invitations: Invitation[];
      supportGrants?: SupportGrant[];
      audit: AuditEvent[];
      usage?: WorkspaceUsage;
      entitlements?: PlanEntitlements | null;
      deletionRequest?: DeletionRequest | null;
      capabilities?: { aiConfigured: boolean };
      workspaces?: Array<AppContext['workspace'] & { role: string }>;
    };
    setAppContext(data.context);
    setMembers(data.members);
    setInvitations(data.invitations);
    setSupportGrants(data.supportGrants || []);
    setAuditEvents(data.audit);
    setWorkspaceUsage(
      data.usage || {
        leads: 0,
        activeEvents: 0,
        knowledgeSources: 0,
        storageBytes: 0,
        activeMembers: 0,
      },
    );
    if (data.entitlements) setPlanEntitlements(data.entitlements);
    setDeletionRequest(data.deletionRequest || null);
    setSettingsLoadedAt(data.serverTime);
    setCapabilities(data.capabilities || { aiConfigured: false });
    setAvailableWorkspaces(data.workspaces || []);
  }
  async function loadOperations() {
    const response = await apiFetch('/api/operations');
    if (response.ok) setOperations((await response.json()) as OperationsData);
    else setOperations(null);
  }
  async function loadKnowledge() {
    const response = await apiFetch('/api/company-intelligence');
    if (response.ok) setKnowledge((await response.json()) as KnowledgeData);
  }
  async function loadRfqs() {
    const response = await apiFetch('/api/rfqs');
    if (response.ok) {
      const data = (await response.json()) as { rfqs: RfqItem[] };
      setRfqs(data.rfqs);
    }
  }
  async function loadQuotations() {
    const response = await apiFetch('/api/quotations');
    if (response.ok) {
      const data = (await response.json()) as { quotations: Quotation[] };
      setQuotations(data.quotations);
    }
  }
  async function loadMeetings() {
    const response = await apiFetch('/api/meetings');
    if (response.ok) {
      const data = (await response.json()) as { meetings: MeetingItem[] };
      setMeetings(data.meetings);
    }
  }
  async function refreshOutbox() {
    try {
      const items = await outboxItems();
      setOutboxCount(items.length);
      setOutboxNeedsReview(
        items.filter((item) => item.status === 'needs_review').length,
      );
    } catch {
      setOutboxCount(0);
      setOutboxNeedsReview(0);
    }
  }
  async function flushOutbox(force = false) {
    if (!navigator.onLine) return;
    const queued = await outboxItems().catch(() => []);
    let synced = 0;
    for (const item of queued) {
      const now = Date.now();
      if (!force && item.status === 'needs_review') continue;
      if (!force && Number(item.nextAttemptAt || 0) > now) continue;
      const form = new FormData();
      Object.entries(item.fields).forEach(([key, value]) =>
        form.set(key, value),
      );
      if (item.attachment) {
        form.set('attachment', item.attachment);
        form.set('attachmentKind', item.attachmentKind || 'document');
      }
      try {
        const headers = new Headers();
        if (item.workspaceId)
          headers.set('x-revenue-workspace-id', item.workspaceId);
        if (item.eventId) headers.set('x-revenue-event-id', item.eventId);
        const response = await fetch('/api/leads', {
          method: 'POST',
          headers,
          body: form,
        });
        const disposition = classifyCaptureResponse(response.status);
        if (disposition === 'synced') {
          await outboxWrite(item.id, 'delete');
          synced += 1;
          continue;
        }
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        if (disposition === 'needs_review') {
          await outboxWrite(
            {
              ...item,
              status: 'needs_review',
              attempts: Number(item.attempts || 0) + 1,
              lastAttemptAt: now,
              nextAttemptAt: 0,
              lastError:
                payload.error ||
                `Capture rejected with HTTP ${response.status}`,
            },
            'put',
          );
          continue;
        }
        await outboxWrite(
          {
            ...item,
            ...nextCaptureRetry(
              Number(item.attempts || 0),
              now,
              payload.error || `Temporary HTTP ${response.status}`,
            ),
          },
          'put',
        );
      } catch {
        await outboxWrite(
          {
            ...item,
            ...nextCaptureRetry(
              Number(item.attempts || 0),
              Date.now(),
              'Network unavailable',
            ),
          },
          'put',
        );
        break;
      }
    }
    await refreshOutbox();
    if (synced) {
      setNotice(
        `${synced} offline capture${synced === 1 ? '' : 's'} synchronized`,
      );
      void loadWorkspace();
    }
  }
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void Promise.all([
        loadWorkspace(),
        loadEvents(),
        loadReports(),
        refreshOutbox(),
      ]).finally(() => setInitializing(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    const tick = () => setClockNow(Date.now());
    tick();
    const timer = window.setInterval(tick, 60_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    const sync = () => {
      void flushOutbox();
    };
    const initialRetry = window.setTimeout(sync, 0);
    const retryTimer = window.setInterval(sync, 15_000);
    window.addEventListener('online', sync);
    return () => {
      window.clearTimeout(initialRetry);
      window.clearInterval(retryTimer);
      window.removeEventListener('online', sync);
    };
  }, []);
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  }, []);
  useEffect(() => {
    const extraction = captureExtraction(reviewLead?.extractedJson);
    if (!reviewLead) return;
    const values = {
      fullName:
        extraction?.fullName ||
        (reviewLead.fullName === 'Unidentified visitor'
          ? ''
          : reviewLead.fullName),
      company:
        extraction?.company ||
        (reviewLead.company === 'Company pending' ? '' : reviewLead.company),
      role: extraction?.role || reviewLead.role || '',
      email: extraction?.email || reviewLead.email || '',
      phone: extraction?.phone || reviewLead.phone || '',
    };
    const timer = window.setTimeout(() => {
      for (const [field, value] of Object.entries(values)) {
        const control = reviewContactForm.current?.elements.namedItem(field);
        if (control instanceof HTMLInputElement) control.value = value;
      }
    }, 120);
    return () => window.clearTimeout(timer);
  }, [reviewLead]);
  function go(view: View) {
    setActiveView(view);
    setMobileNav(false);
    if (view === 'settings') {
      void loadSettings();
      void loadOperations();
    }
    if (view === 'knowledge') void loadKnowledge();
    if (view === 'rfqs') {
      void loadRfqs();
      void loadQuotations();
    }
    if (view === 'meetings') void loadMeetings();
    if (view === 'roi') {
      void loadEvents();
      void loadReports();
    }
    if (view === 'events') {
      void loadEvents();
      void loadSettings();
    }
  }

  async function saveLead(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setCaptureProgress('Saving the original…');
    setSaveError('');
    setCaptureOutcome('');
    const form = new FormData(event.currentTarget);
    form.set('clientCaptureId', crypto.randomUUID());
    if (attachment) {
      form.set('attachment', attachment.file);
      form.set('attachmentKind', attachment.kind);
    }
    try {
      const response = await apiFetch('/api/leads', {
        method: 'POST',
        body: form,
      });
      const data = (await response.json()) as {
        lead?: SavedLead;
        error?: string;
      };
      if (!response.ok || !data.lead) {
        setSaveError(data.error || 'Unable to save this lead.');
        return;
      }
      setSavedLead(data.lead);
      setCapturedLeads((current) => [data.lead!, ...current]);
      void loadWorkspace();
      if (attachment && data.lead.captureStatus) {
        try {
          setCaptureProgress(
            attachment.kind === 'audio'
              ? 'Transcribing the conversation…'
              : 'Reading the capture…',
          );
          const extractionResponse = await apiFetch(
            '/api/capture-extraction',
            {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({
                leadId: data.lead.id,
                demoSample: attachment.name === 'revenue-os-demo-card.png',
              }),
            },
          );
          const extractionData = (await extractionResponse
            .json()
            .catch(() => ({}))) as {
            extraction?: CaptureExtraction;
            status?: string;
            error?: string;
            code?: string;
          };
          if (extractionResponse.ok && extractionData.extraction) {
            const extraction = extractionData.extraction;
            const next = {
              ...data.lead,
              captureStatus:
                extractionData.status || 'completed_pending_review',
              extractedJson: JSON.stringify(extraction),
            };
            const suggestedFields: string[] = (
              ['fullName', 'company', 'role', 'email', 'phone'] as const
            ).filter((field) => Boolean(extraction[field]));
            if (extraction.transcript) suggestedFields.push('transcript');
            setAcceptedCaptureFields(suggestedFields);
            setCapturedLeads((current) =>
              current.map((lead) => (lead.id === next.id ? next : lead)),
            );
            setCaptureOpen(false);
            setTimeout(() => openReview(next), 180);
            setNotice('Capture read · verify the prefilled details');
            return;
          }
          setCaptureOutcome(
            extractionData.code === 'AI_NOT_CONFIGURED'
              ? 'The original is saved. Automatic reading needs an OpenAI API key in this local environment, so you can review and enter the details manually.'
              : extractionData.error ||
                  'The original is saved, but automatic reading did not finish. You can review the contact manually.',
          );
        } catch {
          setCaptureOutcome(
            'The original is saved, but automatic reading could not be reached. You can review the contact manually without creating another lead.',
          );
        }
      }
      setSaved(true);
    } catch (error) {
      try {
        const fields: Record<string, string> = {};
        form.forEach((value, key) => {
          if (typeof value === 'string') fields[key] = value;
        });
        const id = fields.clientCaptureId;
        await outboxWrite(
          {
            id,
            workspaceId:
              window.localStorage.getItem('revenue-workspace-id') ||
              appContext?.workspace.id ||
              '',
            eventId: activeEventId,
            fields,
            attachment: attachment?.file,
            attachmentKind: attachment?.kind,
            queuedAt: Date.now(),
            status: 'queued',
            attempts: 0,
            nextAttemptAt: 0,
          },
          'put',
        );
        const queuedLead: SavedLead = {
          id: `offline-${id}`,
          fullName: fields.fullName,
          company: fields.company,
          role: fields.role,
          note: fields.note,
          nextAction: fields.nextAction,
          dueDate: fields.dueDate,
          reviewStatus: 'queued_offline',
          createdAt: Date.now(),
        };
        setSavedLead(queuedLead);
        setCapturedLeads((current) => [queuedLead, ...current]);
        setSaved(true);
        await refreshOutbox();
      } catch {
        setSaveError(
          error instanceof Error ? error.message : 'Unable to save this lead.',
        );
      }
    } finally {
      setCaptureProgress('');
      setSaving(false);
    }
  }
  function resetCapture(open: boolean) {
    setCaptureOpen(open);
    if (!open) {
      if (recording) recorder.current?.stop();
      setTimeout(() => {
        if (attachment?.url) URL.revokeObjectURL(attachment.url);
        setAttachment(null);
        setSaved(false);
        setSavedLead(null);
        setSaveError('');
        setCaptureProgress('');
        setCaptureOutcome('');
      }, 150);
    }
  }

  function selectAttachment(
    event: SyntheticEvent<HTMLInputElement>,
    kind: 'card' | 'badge' | 'qr',
  ) {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    if (attachment?.url) URL.revokeObjectURL(attachment.url);
    setAttachment({
      name: file.name,
      url: URL.createObjectURL(file),
      kind,
      file,
    });
  }

  function loadDemoCard() {
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 700;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.fillStyle = '#f7f4ee';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#14213d';
    context.fillRect(0, 0, 34, canvas.height);
    context.font = '700 54px system-ui';
    context.fillStyle = '#14213d';
    context.fillText('Maya Kapoor', 100, 170);
    context.font = '32px system-ui';
    context.fillStyle = '#3d4966';
    context.fillText('Procurement Director', 100, 235);
    context.font = '700 38px system-ui';
    context.fillStyle = '#d66b35';
    context.fillText('ACME PHARMA', 100, 335);
    context.font = '28px system-ui';
    context.fillStyle = '#3d4966';
    context.fillText('maya.kapoor@example.com', 100, 445);
    context.fillText('+1 415 555 0148', 100, 500);
    canvas.toBlob((blob) => {
      if (!blob) return;
      if (attachment?.url) URL.revokeObjectURL(attachment.url);
      const file = new File([blob], 'revenue-os-demo-card.png', {
        type: 'image/png',
      });
      setAttachment({
        name: file.name,
        url: URL.createObjectURL(file),
        kind: 'card',
        file,
      });
      setSaveError('');
    }, 'image/png');
  }

  async function toggleRecording() {
    if (recording) {
      recorder.current?.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const nextRecorder = new MediaRecorder(stream);
      audioChunks.current = [];
      nextRecorder.ondataavailable = (event) => {
        if (event.data.size) audioChunks.current.push(event.data);
      };
      nextRecorder.onstop = () => {
        const blob = new Blob(audioChunks.current, {
          type: nextRecorder.mimeType || 'audio/webm',
        });
        if (attachment?.url) URL.revokeObjectURL(attachment.url);
        const file = new File([blob], `conversation-${Date.now()}.webm`, {
          type: blob.type,
        });
        setAttachment({
          name: file.name,
          url: URL.createObjectURL(file),
          kind: 'audio',
          file,
        });
        stream.getTracks().forEach((track) => track.stop());
        setRecording(false);
      };
      recorder.current = nextRecorder;
      nextRecorder.start();
      setRecording(true);
      setSaveError('');
    } catch {
      setSaveError(
        'Microphone access was not available. You can still type the conversation note.',
      );
    }
  }

  function openReview(lead: SavedLead) {
    setActiveView('today');
    setMobileNav(false);
    setReviewLead(lead);
    setAnalysis(null);
    setExtractionId('');
    setAnalysisError('');
    setConfirmed(false);
    setFollowups([]);
    void loadFollowups(lead.id);
    if (['owner', 'admin', 'manager'].includes(appContext?.role || ''))
      void loadSettings();
  }

  async function loadFollowups(leadId: string) {
    const response = await apiFetch(
      `/api/followups?leadId=${encodeURIComponent(leadId)}`,
    );
    if (response.ok) {
      const data = (await response.json()) as { drafts: FollowupDraft[] };
      setFollowups(data.drafts);
    }
  }
  async function generateFollowup(channel: 'email' | 'whatsapp') {
    if (!reviewLead) return;
    setDrafting(channel);
    setAnalysisError('');
    const response = await apiFetch('/api/followups', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'generate',
        leadId: reviewLead.id,
        channel,
      }),
    });
    const data = (await response.json()) as {
      draft?: FollowupDraft;
      error?: string;
    };
    if (response.ok && data.draft)
      setFollowups((current) => [data.draft!, ...current]);
    else setAnalysisError(data.error || 'Could not create follow-up draft.');
    setDrafting('');
  }
  async function approveFollowup(draft: FollowupDraft) {
    const response = await apiFetch('/api/followups', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'approve',
        id: draft.id,
        version: draft.version,
      }),
    });
    const data = (await response.json()) as { error?: string; status?: string };
    if (response.ok)
      setFollowups((current) =>
        current.map((item) =>
          item.id === draft.id ? { ...item, status: 'approved' } : item,
        ),
      );
    else setAnalysisError(data.error || 'Could not approve this draft.');
  }
  async function editFollowup(
    event: SyntheticEvent<HTMLFormElement>,
    draft: FollowupDraft,
  ) {
    event.preventDefault();
    const values = Object.fromEntries(
      new FormData(event.currentTarget).entries(),
    );
    const response = await apiFetch('/api/followups', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'edit',
        id: draft.id,
        version: draft.version,
        ...values,
      }),
    });
    const data = (await response.json()) as {
      draft?: Partial<FollowupDraft>;
      error?: string;
    };
    if (!response.ok || !data.draft) {
      setAnalysisError(data.error || 'Could not save this draft.');
      return;
    }
    setFollowups((current) =>
      current.map((item) =>
        item.id === draft.id ? { ...item, ...data.draft } : item,
      ),
    );
    setNotice('Draft saved · approval reset');
  }
  async function openApprovedFollowup(draft: FollowupDraft) {
    if (draft.status !== 'approved') return;
    const response = await apiFetch('/api/followups', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'authorize_open', id: draft.id }),
    });
    const data = (await response.json()) as {
      draft?: FollowupDraft;
      error?: string;
    };
    if (!response.ok || !data.draft) {
      setAnalysisError(
        data.error || 'This message is no longer eligible to open.',
      );
      return;
    }
    const authorized = data.draft;
    const url =
      authorized.channel === 'email'
        ? `mailto:${encodeURIComponent(authorized.recipient)}?subject=${encodeURIComponent(authorized.subject || '')}&body=${encodeURIComponent(authorized.body)}`
        : `https://wa.me/${authorized.recipient.replace(/\D/g, '')}?text=${encodeURIComponent(authorized.body)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }
  async function setStakeholderRole(buyingRole: string) {
    if (!reviewLead) return;
    const response = await apiFetch('/api/workspace', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'set_stakeholder',
        leadId: reviewLead.id,
        buyingRole,
      }),
    });
    const data = (await response.json()) as {
      error?: string;
      status?: string;
    };
    if (!response.ok) {
      setAnalysisError(data.error || 'Could not update stakeholder role.');
      return;
    }
    setReviewLead({ ...reviewLead, buyingRole });
    setCapturedLeads((current) =>
      current.map((lead) =>
        lead.id === reviewLead.id ? { ...lead, buyingRole } : lead,
      ),
    );
    setNotice('Buying-committee role saved');
  }
  async function setContactPermission(
    channel: 'email' | 'whatsapp',
    status: 'granted' | 'withdrawn',
  ) {
    if (!reviewLead) return;
    const response = await apiFetch('/api/workspace', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'set_consent',
        leadId: reviewLead.id,
        channel,
        status,
        source: 'salesperson_attestation',
      }),
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setAnalysisError(data.error || 'Could not update contact permission.');
      return;
    }
    const field =
      channel === 'email' ? 'emailConsentStatus' : 'whatsappConsentStatus';
    const next = { ...reviewLead, [field]: status };
    setReviewLead(next);
    setCapturedLeads((current) =>
      current.map((lead) => (lead.id === next.id ? next : lead)),
    );
    setNotice(
      `${channel === 'email' ? 'Email' : 'WhatsApp'} permission ${status}`,
    );
  }
  async function mergeDuplicateLead(source: SavedLead) {
    if (
      !source.duplicateLeadId ||
      !window.confirm(
        `Merge ${source.fullName} into ${source.duplicateLeadName || 'the existing contact'}? You can undo this from People.`,
      )
    )
      return;
    const response = await apiFetch('/api/workspace', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'merge_leads',
        sourceLeadId: source.id,
        targetLeadId: source.duplicateLeadId,
      }),
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setAnalysisError(data.error || 'Could not merge contacts.');
      return;
    }
    setReviewLead(null);
    setNotice('Contacts merged · undo is available in People');
    await loadWorkspace();
  }
  async function revertLeadMerge(id: string) {
    const response = await apiFetch('/api/workspace', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'revert_lead_merge', mergeId: id }),
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setNotice(data.error || 'Could not undo merge');
      return;
    }
    setNotice('Contact merge reversed');
    await loadWorkspace();
  }
  async function updateQualification(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reviewLead) return;
    const values = Object.fromEntries(
      new FormData(event.currentTarget).entries(),
    );
    const response = await apiFetch('/api/workspace', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'set_qualification',
        leadId: reviewLead.id,
        ...values,
      }),
    });
    const data = (await response.json()) as {
      error?: string;
      state?: string;
      reason?: string;
    };
    if (!response.ok) {
      setAnalysisError(data.error || 'Could not update qualification.');
      return;
    }
    const next = {
      ...reviewLead,
      qualificationState: data.state,
      qualificationReason: data.reason,
    };
    setReviewLead(next);
    setCapturedLeads((current) =>
      current.map((lead) => (lead.id === next.id ? next : lead)),
    );
    setNotice('Qualification override recorded');
  }
  async function assignLeadOwner(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reviewLead) return;
    const values = Object.fromEntries(
      new FormData(event.currentTarget).entries(),
    );
    const response = await apiFetch('/api/workspace', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'assign_lead',
        leadId: reviewLead.id,
        ...values,
      }),
    });
    const data = (await response.json()) as {
      error?: string;
      ownerId?: string;
    };
    if (!response.ok) {
      setAnalysisError(data.error || 'Could not assign contact.');
      return;
    }
    const owner = members.find((member) => member.userId === data.ownerId);
    const next = {
      ...reviewLead,
      ownerId: data.ownerId,
      ownerName: owner?.displayName || owner?.email,
    };
    setReviewLead(next);
    setCapturedLeads((current) =>
      current.map((lead) => (lead.id === next.id ? next : lead)),
    );
    setNotice('Lead owner updated');
  }

  async function processCapture() {
    if (!reviewLead) return;
    setExtractingCapture(true);
    setAnalysisError('');
    const response = await apiFetch('/api/capture-extraction', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ leadId: reviewLead.id }),
    });
    const data = (await response.json()) as {
      extraction?: CaptureExtraction;
      status?: string;
      error?: string;
    };
    if (!response.ok || !data.extraction)
      setAnalysisError(data.error || 'Could not process this capture.');
    else {
      const extraction = data.extraction;
      const next = {
        ...reviewLead,
        captureStatus: data.status || 'completed_pending_review',
        extractedJson: JSON.stringify(extraction),
      };
      const suggestedFields: string[] = (
        ['fullName', 'company', 'role', 'email', 'phone'] as const
      ).filter((field) => Boolean(extraction[field]));
      if (extraction.transcript) suggestedFields.push('transcript');
      setAcceptedCaptureFields(suggestedFields);
      setReviewLead(next);
      setCapturedLeads((current) =>
        current.map((lead) => (lead.id === next.id ? next : lead)),
      );
      setNotice('Capture processed · review every extracted field');
      void loadWorkspace();
    }
    setExtractingCapture(false);
  }

  function applyCaptureSuggestion(
    field: 'fullName' | 'company' | 'role' | 'email' | 'phone',
    value: string,
  ) {
    setAcceptedCaptureFields((current) =>
      current.includes(field) ? current : [...current, field],
    );
    window.setTimeout(() => {
      const control = reviewContactForm.current?.elements.namedItem(field);
      if (control instanceof HTMLInputElement) control.value = value;
    }, 0);
  }

  function markCaptureCorrection(field: string) {
    setAcceptedCaptureFields((current) =>
      current.filter((item) => item !== field),
    );
  }

  async function saveLeadDetails(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reviewLead) return;
    const values = Object.fromEntries(
      new FormData(event.currentTarget).entries(),
    );
    const pendingCaptureReview =
      reviewLead.captureStatus === 'completed_pending_review';
    const response = await apiFetch(
      pendingCaptureReview ? '/api/capture-extraction' : '/api/workspace',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: pendingCaptureReview ? 'confirm' : 'update_lead',
          ...(pendingCaptureReview
            ? { leadId: reviewLead.id, acceptedFields: acceptedCaptureFields }
            : { id: reviewLead.id }),
          ...values,
        }),
      },
    );
    const data = (await response.json()) as {
      lead?: Partial<SavedLead>;
      error?: string;
    };
    if (!response.ok || !data.lead) {
      setAnalysisError(data.error || 'Could not save contact details.');
      return;
    }
    const next = {
      ...reviewLead,
      ...data.lead,
      captureStatus: pendingCaptureReview
        ? 'confirmed'
        : reviewLead.captureStatus,
    };
    if (pendingCaptureReview) setAcceptedCaptureFields([]);
    setReviewLead(next);
    setCapturedLeads((current) =>
      current.map((lead) => (lead.id === next.id ? next : lead)),
    );
    setNotice(
      pendingCaptureReview
        ? 'Extraction reviewed and verified details saved'
        : 'Contact details saved',
    );
    void loadWorkspace();
  }

  async function eraseLead() {
    if (
      !reviewLead ||
      !window.confirm(
        `Erase personal data for ${reviewLead.fullName}? Conversation notes, tasks, AI facts, drafts, and capture files will be permanently removed. Company-level revenue records will remain.`,
      )
    )
      return;
    const id = reviewLead.id;
    const response = await apiFetch('/api/workspace', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'erase_lead', id }),
    });
    const data = (await response.json()) as {
      error?: string;
      status?: string;
    };
    if (!response.ok) {
      setAnalysisError(data.error || 'Could not erase this contact.');
      return;
    }
    setReviewLead(null);
    setCapturedLeads((current) =>
      current.map((lead) =>
        lead.id === id
          ? {
              ...lead,
              fullName: 'Deleted contact',
              role: undefined,
              email: undefined,
              phone: undefined,
              note: undefined,
              nextAction: undefined,
              dueDate: undefined,
              reviewStatus:
                data.status === 'completed' ? 'erased' : 'erasure_pending',
              captureStatus: undefined,
              extractedJson: undefined,
            }
          : lead,
      ),
    );
    setNotice(
      data.status === 'completed'
        ? 'Personal data erased and verified; company revenue history retained'
        : 'Personal data hidden; durable erasure is queued for automatic retry',
    );
    void loadWorkspace();
  }

  async function createLeadTask(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reviewLead) return;
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    const response = await apiFetch('/api/workspace', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'create_task',
        leadId: reviewLead.id,
        ...values,
      }),
    });
    const data = (await response.json()) as { task?: TaskItem; error?: string };
    if (!response.ok || !data.task) {
      setAnalysisError(data.error || 'Could not create task.');
      return;
    }
    form.reset();
    setNotice('Follow-up task created');
    void loadWorkspace();
  }

  async function updateOpportunityStage(
    item: Opportunity,
    stage: string,
    value = item.value,
  ) {
    let reason = '';
    if (stage === 'lost')
      reason =
        window
          .prompt(
            'Why was this opportunity lost? This reason will be retained in history.',
            item.lossReason || '',
          )
          ?.trim() || '';
    else if (['won', 'lost'].includes(item.stage) && stage !== item.stage)
      reason =
        window.prompt('Why is this closed opportunity changing?')?.trim() || '';
    if (
      (stage === 'lost' ||
        (['won', 'lost'].includes(item.stage) && stage !== item.stage)) &&
      !reason
    ) {
      setNotice('A reason is required for this change.');
      return;
    }
    const response = await apiFetch('/api/workspace', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'update_opportunity',
        id: item.id,
        stage,
        value,
        version: item.version,
        reason,
      }),
    });
    const data = (await response.json()) as {
      probability?: number;
      value?: number;
      version?: number;
      lossReason?: string;
      closedAt?: number;
      error?: string;
    };
    if (!response.ok) {
      setNotice(data.error || 'Could not update opportunity');
      void loadWorkspace();
      return;
    }
    setOpportunities((current) =>
      current.map((currentItem) =>
        currentItem.id === item.id
          ? {
              ...currentItem,
              stage,
              value: data.value ?? currentItem.value,
              version: data.version ?? currentItem.version,
              probability: data.probability ?? currentItem.probability,
              lossReason: data.lossReason,
              closedAt: data.closedAt,
            }
          : currentItem,
      ),
    );
    setNotice('Opportunity updated with history');
  }

  async function changeOpportunityValue(item: Opportunity) {
    const answer = window.prompt(
      `Update opportunity value (${item.currency})`,
      String(item.value),
    );
    if (answer === null) return;
    const value = Number(answer);
    if (!Number.isFinite(value) || value < 0) {
      setNotice('Enter a valid non-negative value.');
      return;
    }
    await updateOpportunityStage(item, item.stage, value);
  }

  async function changeOpportunityContact(
    item: Opportunity,
    leadId: string,
    command: 'add' | 'remove',
  ) {
    const response = await apiFetch('/api/workspace', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: `${command}_opportunity_contact`,
        id: item.id,
        leadId,
      }),
    });
    const data = (await response.json()) as {
      contact?: OpportunityContact;
      error?: string;
    };
    if (!response.ok) {
      setNotice(data.error || 'Could not update opportunity contacts.');
      void loadWorkspace();
      return;
    }
    setNotice(command === 'add' ? 'Stakeholder linked' : 'Stakeholder removed');
    void loadWorkspace();
  }

  async function analyzeConversation() {
    if (!reviewLead) return;
    setAnalyzing(true);
    setAnalysisError('');
    try {
      const response = await apiFetch('/api/analysis', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ leadId: reviewLead.id }),
      });
      const data = (await response.json()) as {
        analysis?: Analysis;
        extractionId?: string;
        error?: string;
      };
      if (!response.ok || !data.analysis || !data.extractionId)
        throw new Error(data.error || 'Unable to analyze this conversation.');
      setAnalysis(data.analysis);
      setExtractionId(data.extractionId);
    } catch (error) {
      setAnalysisError(
        error instanceof Error
          ? error.message
          : 'Unable to analyze this conversation.',
      );
    } finally {
      setAnalyzing(false);
    }
  }

  async function confirmAnalysis() {
    const response = await apiFetch('/api/analysis/confirm', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        extractionId,
        commitments: analysis?.commitments,
      }),
    });
    if (response.ok) {
      setConfirmed(true);
      setCapturedLeads((current) =>
        current.map((lead) =>
          lead.id === reviewLead?.id
            ? { ...lead, reviewStatus: 'confirmed' }
            : lead,
        ),
      );
    } else {
      const data = (await response.json()) as { error?: string };
      setAnalysisError(
        data.error || 'Could not confirm this analysis. Please try again.',
      );
    }
  }

  async function updateTask(
    task: TaskItem,
    command:
      | 'complete'
      | 'cancel'
      | 'reopen'
      | 'schedule_reminder'
      | 'clear_reminder',
  ) {
    let reason = '';
    let reminderAt: number | undefined;
    if (command === 'cancel' || command === 'reopen') {
      reason =
        window
          .prompt(
            command === 'cancel'
              ? 'Why is this commitment being cancelled?'
              : 'Why is this commitment being reopened?',
          )
          ?.trim() || '';
      if (!reason) return;
    }
    if (command === 'schedule_reminder')
      reminderAt = clockNow + 24 * 60 * 60 * 1000;
    const response = await apiFetch('/api/workspace', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'update_task',
        id: task.id,
        version: task.version,
        command,
        reason,
        reminderAt,
      }),
    });
    const data = (await response.json()) as {
      task?: Partial<TaskItem>;
      error?: string;
    };
    if (!response.ok || !data.task) {
      setNotice(data.error || 'Could not update this task.');
      void loadWorkspace();
      return;
    }
    setTasks((current) =>
      current.map((item) =>
        item.id === task.id ? { ...item, ...data.task } : item,
      ),
    );
    setNotice(
      command === 'schedule_reminder'
        ? 'Reminder scheduled for tomorrow'
        : command === 'clear_reminder'
          ? 'Reminder cleared'
          : command === 'complete'
            ? 'Task completed'
            : command === 'cancel'
              ? 'Task cancelled'
              : 'Task reopened',
    );
    setTimeout(() => setNotice(''), 2200);
    void loadWorkspace();
  }

  async function createMeeting(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries()) as Record<
      string,
      string
    >;
    const startValue = Date.parse(values.startsAt || '');
    const endValue = Date.parse(values.endsAt || '');
    if (!Number.isFinite(startValue) || !Number.isFinite(endValue)) {
      setNotice('Choose valid meeting start and end times.');
      return;
    }
    const startsAt = new Date(startValue).toISOString();
    const endsAt = new Date(endValue).toISOString();
    const response = await apiFetch('/api/meetings', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'create', ...values, startsAt, endsAt }),
    });
    const data = (await response.json()) as {
      meeting?: MeetingItem;
      error?: string;
    };
    if (!response.ok || !data.meeting) {
      setNotice(data.error || 'Could not schedule the meeting.');
      return;
    }
    setMeetings((current) => [data.meeting!, ...current]);
    form.reset();
    setNotice('Meeting scheduled');
  }

  async function transitionMeeting(
    meeting: MeetingItem,
    command: 'complete' | 'cancel' | 'reopen',
  ) {
    let reason = '';
    if (command === 'cancel' || command === 'reopen') {
      reason =
        window
          .prompt(
            command === 'cancel'
              ? 'Why is this meeting being cancelled?'
              : 'Why is this meeting being reopened?',
          )
          ?.trim() || '';
      if (!reason) return;
    }
    const response = await apiFetch('/api/meetings', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'transition',
        id: meeting.id,
        version: meeting.version,
        command,
        reason,
      }),
    });
    const data = (await response.json()) as {
      meeting?: Partial<MeetingItem>;
      error?: string;
    };
    if (!response.ok || !data.meeting) {
      setNotice(data.error || 'Could not update this meeting.');
      void loadMeetings();
      return;
    }
    setMeetings((current) =>
      current.map((item) =>
        item.id === meeting.id ? { ...item, ...data.meeting } : item,
      ),
    );
    setNotice(
      command === 'complete'
        ? 'Meeting completed'
        : command === 'cancel'
          ? 'Meeting cancelled'
          : 'Meeting reopened',
    );
  }

  async function downloadMeeting(meeting: MeetingItem) {
    const response = await apiFetch(
      `/api/meetings?id=${encodeURIComponent(meeting.id)}&format=ics`,
    );
    if (!response.ok) {
      setNotice('Calendar file is unavailable.');
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${meeting.title.replace(/[^a-z0-9]+/gi, '-') || 'meeting'}.ics`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function createOpportunity(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const payload = {
      ...Object.fromEntries(formData.entries()),
      contactIds: formData.getAll('contactIds').map(String),
    };
    const response = await apiFetch('/api/workspace', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'create_opportunity', ...payload }),
    });
    const data = (await response.json()) as {
      opportunity?: Opportunity;
      error?: string;
    };
    if (!response.ok || !data.opportunity) {
      setNotice(data.error || 'Could not create opportunity');
      return;
    }
    setOpportunityOpen(false);
    setOpportunityLead(null);
    setNotice('Opportunity created');
    setTimeout(() => setNotice(''), 1800);
    void loadWorkspace();
  }

  async function saveSettings(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = Object.fromEntries(
      new FormData(event.currentTarget).entries(),
    );
    const response = await apiFetch('/api/settings', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'update_workspace', ...values }),
    });
    const data = (await response.json()) as {
      workspace?: AppContext['workspace'];
      error?: string;
    };
    if (!response.ok || !data.workspace) {
      setNotice(data.error || 'Could not save settings');
      return;
    }
    setAppContext((current) =>
      current ? { ...current, workspace: data.workspace! } : current,
    );
    setNotice('Workspace settings saved');
    setTimeout(() => setNotice(''), 1800);
    void loadSettings();
  }

  async function inviteMember(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    const response = await apiFetch('/api/settings', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'invite', ...values }),
    });
    const data = (await response.json()) as {
      invitation?: Invitation;
      error?: string;
    };
    if (!response.ok || !data.invitation) {
      setNotice(data.error || 'Could not create invitation');
      return;
    }
    form.reset();
    setInvitations((current) => [data.invitation!, ...current]);
    setNotice('Invitation recorded');
    setTimeout(() => setNotice(''), 1800);
    void loadSettings();
  }

  async function createWorkspace(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    const response = await apiFetch('/api/settings', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'create_workspace', ...values }),
    });
    const data = (await response.json()) as {
      workspace?: AppContext['workspace'];
      error?: string;
    };
    if (!response.ok || !data.workspace) {
      setNotice(data.error || 'Could not create workspace');
      return;
    }
    window.localStorage.setItem('revenue-workspace-id', data.workspace.id);
    window.localStorage.removeItem('revenue-event-id');
    setActiveEventId('');
    setEvents([]);
    form.reset();
    setNotice('Workspace created');
    await loadWorkspace();
    await loadSettings();
    await loadEvents();
  }

  async function switchWorkspace(id: string) {
    window.localStorage.setItem('revenue-workspace-id', id);
    window.localStorage.removeItem('revenue-event-id');
    setActiveEventId('');
    setNotice('Workspace switched');
    await loadWorkspace();
    await loadSettings();
    await loadEvents();
  }

  async function updateMember(id: string, role: string, status: string) {
    const response = await apiFetch('/api/settings', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'update_member', id, role, status }),
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setNotice(data.error || 'Could not update member');
      return;
    }
    setNotice('Member updated');
    void loadSettings();
  }

  async function revokeInvitation(id: string) {
    const response = await apiFetch('/api/settings', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'revoke_invitation', id }),
    });
    if (response.ok) {
      setNotice('Invitation revoked');
      void loadSettings();
    }
  }

  async function grantSupportAccess(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    const response = await apiFetch('/api/settings', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'grant_support', ...values }),
    });
    const data = (await response.json()) as {
      grant?: SupportGrant;
      error?: string;
    };
    if (!response.ok || !data.grant) {
      setNotice(data.error || 'Could not grant support access.');
      return;
    }
    form.reset();
    setNotice('Time-limited read-only support access granted');
    await loadSettings();
  }

  async function revokeSupportAccess(id: string) {
    const response = await apiFetch('/api/settings', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'revoke_support', id }),
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setNotice(data.error || 'Could not revoke support access.');
      return;
    }
    setNotice('Support access revoked immediately');
    await loadSettings();
  }

  async function exportWorkspace() {
    const response = await apiFetch('/api/settings?export=1');
    if (!response.ok) {
      setNotice('Export could not be prepared');
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${appContext?.workspace.slug || 'workspace'}-export.json`;
    link.click();
    URL.revokeObjectURL(url);
    setNotice('Workspace export downloaded');
  }

  async function submitWorkspaceDeletion(
    event: SyntheticEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    const action = typeof values.action === 'string' ? values.action : '';
    const response = await apiFetch('/api/settings', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(values),
    });
    const data = (await response.json()) as {
      error?: string;
      deletionRequest?: DeletionRequest;
    };
    if (!response.ok) {
      setNotice(data.error || 'Could not update workspace deletion');
      return;
    }
    if (action === 'execute_deletion') {
      await clearWorkspaceOfflineData(appContext?.workspace.id || '').catch(
        () => undefined,
      );
      window.localStorage.removeItem('revenue-workspace-id');
      window.localStorage.removeItem('revenue-event-id');
      window.location.reload();
      return;
    }
    if (data.deletionRequest) setDeletionRequest(data.deletionRequest);
    form.reset();
    setNotice('Workspace deletion scheduled with a seven-day recovery period');
  }

  async function cancelWorkspaceDeletion() {
    const response = await apiFetch('/api/settings', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'cancel_deletion' }),
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setNotice(data.error || 'Could not cancel deletion');
      return;
    }
    setDeletionRequest(null);
    setNotice('Workspace deletion canceled');
  }

  async function operationsAction(
    action: 'run_workspace_jobs' | 'retry_job' | 'acknowledge_alert',
    id?: string,
  ) {
    const response = await apiFetch('/api/operations', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action, id }),
    });
    const data = (await response.json()) as {
      error?: string;
      claimed?: number;
    };
    if (!response.ok) {
      setNotice(data.error || 'Could not update operations.');
      return;
    }
    setNotice(
      action === 'run_workspace_jobs'
        ? `${data.claimed || 0} due background jobs processed`
        : 'Operations record updated',
    );
    await loadOperations();
  }

  async function submitKnowledge(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    const response = await apiFetch('/api/company-intelligence', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(values),
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setNotice(data.error || 'Could not save company intelligence');
      return;
    }
    form.reset();
    setNotice('Company intelligence saved');
    await loadKnowledge();
  }

  async function uploadKnowledge(event: SyntheticEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.set('file', file);
    const response = await apiFetch('/api/company-intelligence', {
      method: 'POST',
      body: form,
    });
    const data = (await response.json()) as { error?: string };
    setNotice(
      response.ok
        ? 'Knowledge file stored securely'
        : data.error || 'Upload failed',
    );
    if (response.ok) await loadKnowledge();
    event.currentTarget.value = '';
  }

  async function removeKnowledge(
    action: 'archive_product' | 'remove_icp' | 'archive_rule' | 'remove_source',
    id: string,
    label: string,
  ) {
    if (!window.confirm(`Remove ${label}? This change cannot be undone.`))
      return;
    const response = await apiFetch('/api/company-intelligence', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action, id }),
    });
    const data = (await response.json()) as { error?: string };
    setNotice(
      response.ok
        ? `${label} removed`
        : data.error || `Could not remove ${label}`,
    );
    if (response.ok) await loadKnowledge();
  }

  async function reviewKnowledge(
    action:
      | 'approve_source'
      | 'reject_source'
      | 'retry_source'
      | 'approve_claim'
      | 'retire_claim',
    id: string,
  ) {
    const response = await apiFetch('/api/company-intelligence', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action, id }),
    });
    const data = (await response.json()) as { error?: string; status?: string };
    setNotice(
      response.ok
        ? `Review recorded: ${data.status || 'updated'}`
        : data.error || 'Could not record the review',
    );
    if (response.ok) await loadKnowledge();
  }

  async function submitEvent(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const values = Object.fromEntries(formData.entries());
    values.teamMemberIds = formData
      .getAll('teamMemberIds')
      .map(String)
      .join(',');
    const response = await apiFetch('/api/events', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'create', ...values }),
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setNotice(data.error || 'Could not create event');
      return;
    }
    form.reset();
    setNotice('Event created');
    await loadEvents();
  }

  async function eventAction(
    action: 'duplicate' | 'archive' | 'assess_readiness' | 'activate',
    id: string,
  ) {
    const response = await apiFetch('/api/events', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action, id }),
    });
    const data = (await response.json()) as {
      error?: string;
      status?: string;
      checks?: Array<{ passed: boolean }>;
    };
    if (response.ok) {
      if (action === 'archive' && activeEventId === id) void selectEvent('');
      setNotice(
        action === 'duplicate'
          ? 'Event duplicated'
          : action === 'archive'
            ? 'Event archived'
            : action === 'activate'
              ? 'Event activated and ready for device caching'
              : data.status === 'ready'
                ? 'Readiness passed. Activate the event for capture.'
                : `${data.checks?.filter((check) => !check.passed).length || 0} required readiness checks need attention`,
      );
      await loadEvents();
    } else setNotice(data.error || `Could not ${action} event`);
  }

  async function submitRfq(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const response = await apiFetch('/api/rfqs', {
      method: 'POST',
      body: new FormData(form),
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setNotice(data.error || 'Could not create RFQ');
      return;
    }
    form.reset();
    setNotice('RFQ intake created');
    await loadRfqs();
  }
  async function updateRfqStatus(item: RfqItem, status: string) {
    let note = '';
    if (status === 'clarification')
      note =
        window
          .prompt('What clarification is required from the customer?')
          ?.trim() || '';
    else if (
      status === 'lost' ||
      (['won', 'lost'].includes(item.status) && status !== item.status)
    )
      note =
        window
          .prompt(
            status === 'lost'
              ? 'Why was this RFQ lost?'
              : 'Why is this closed RFQ changing?',
          )
          ?.trim() || '';
    if (
      (status === 'clarification' ||
        status === 'lost' ||
        (['won', 'lost'].includes(item.status) && status !== item.status)) &&
      !note
    ) {
      setNotice('A reason is required for this RFQ change.');
      return;
    }
    const response = await apiFetch('/api/rfqs', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'update_status',
        id: item.id,
        status,
        version: item.version,
        note,
      }),
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setNotice(data.error || 'Could not update RFQ status.');
      await loadRfqs();
      return;
    }
    setNotice('RFQ status updated with history');
    await loadRfqs();
  }
  async function recordRfqSubmission(item: RfqItem) {
    const note =
      window
        .prompt(
          'What was submitted? Include the quotation or proposal reference.',
        )
        ?.trim() || '';
    if (!note) return;
    const response = await apiFetch('/api/rfqs', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'record_submission',
        id: item.id,
        version: item.version,
        note,
      }),
    });
    const data = (await response.json()) as {
      submissionVersion?: number;
      error?: string;
    };
    if (!response.ok) {
      setNotice(data.error || 'Could not record this submission.');
      await loadRfqs();
      return;
    }
    setNotice(`RFQ submission v${data.submissionVersion} recorded`);
    await loadRfqs();
  }
  async function analyzeRfq(id: string) {
    setProcessingRfq(id);
    const response = await apiFetch('/api/rfqs/extract', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'analyze', rfqId: id }),
    });
    const data = (await response.json()) as { error?: string };
    setNotice(
      response.ok
        ? 'RFQ requirements extracted · confirm before use'
        : data.error || 'Could not extract RFQ',
    );
    setProcessingRfq('');
    await loadRfqs();
  }
  async function confirmRfqExtraction(
    event: SyntheticEvent<HTMLFormElement>,
    item: RfqItem,
  ) {
    event.preventDefault();
    if (!item.extractionId) return;
    const form = new FormData(event.currentTarget);
    const products = form.getAll('product').map(String);
    const quantities = form.getAll('quantity').map(String);
    const specifications = form.getAll('specifications').map(String);
    const deliveryEntry = form.get('deliveryLocation');
    const deadlineEntry = form.get('submissionDeadline');
    const reviewedExtraction = {
      deliveryLocation: typeof deliveryEntry === 'string' ? deliveryEntry : '',
      submissionDeadline:
        typeof deadlineEntry === 'string' ? deadlineEntry : '',
      items: products.map((product, index) => ({
        product,
        quantity: quantities[index] || '',
        specifications: specifications[index] || '',
      })),
    };
    setProcessingRfq(item.id);
    const response = await apiFetch('/api/rfqs/extract', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'confirm',
        rfqId: item.id,
        extractionId: item.extractionId,
        reviewedExtraction,
      }),
    });
    const data = (await response.json()) as { error?: string };
    setNotice(
      response.ok
        ? 'Reviewed RFQ requirements confirmed'
        : data.error || 'Could not confirm RFQ extraction',
    );
    setProcessingRfq('');
    await loadRfqs();
  }
  async function submitQuotation(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const response = await apiFetch('/api/quotations', {
      method: 'POST',
      body: new FormData(form),
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setNotice(data.error || 'Could not create quotation');
      return;
    }
    form.reset();
    setNotice('Quotation created');
    await loadQuotations();
  }
  async function updateQuotationStatus(item: Quotation, status: string) {
    const note =
      status === 'rejected'
        ? window
            .prompt('Why did the customer reject this quotation?')
            ?.trim() || ''
        : '';
    if (status === 'rejected' && !note) {
      setNotice('A rejection reason is required.');
      return;
    }
    const response = await apiFetch('/api/quotations', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'update_status',
        id: item.id,
        status,
        version: item.version,
        note,
      }),
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setNotice(data.error || 'Could not update quotation');
      return;
    }
    setNotice('Quotation status updated');
    await loadQuotations();
  }
  async function reviseQuotation(item: Quotation) {
    const amountValue = window.prompt(
      `New amount (${item.currency})`,
      String(item.amount),
    );
    if (amountValue === null) return;
    const amount = Number(amountValue);
    if (!Number.isFinite(amount) || amount <= 0) {
      setNotice('Enter a positive quotation amount.');
      return;
    }
    const validUntil =
      window
        .prompt('New valid-until date (YYYY-MM-DD)', item.validUntil || '')
        ?.trim() ?? '';
    if (validUntil && !/^\d{4}-\d{2}-\d{2}$/.test(validUntil)) {
      setNotice('Use YYYY-MM-DD for the valid-until date.');
      return;
    }
    const note =
      window.prompt('Why is this quotation being revised?')?.trim() || '';
    if (!note) return;
    const response = await apiFetch('/api/quotations', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'revise',
        id: item.id,
        version: item.version,
        amount,
        validUntil,
        note,
      }),
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setNotice(data.error || 'Could not revise quotation.');
      await loadQuotations();
      return;
    }
    setNotice(`Quotation v${item.version + 1} created for internal approval`);
    await loadQuotations();
  }
  async function downloadQuotation(item: Quotation) {
    const response = await apiFetch(
      `/api/quotations?download=${encodeURIComponent(item.id)}`,
    );
    if (!response.ok) {
      setNotice('Quotation document is unavailable');
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = item.originalName || `${item.quoteNumber}.pdf`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function submitEventCost(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeEventId) {
      setNotice('Select one event before adding reconciled costs.');
      return;
    }
    const form = event.currentTarget;
    const values = new FormData(form);
    const response = await apiFetch('/api/reports', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'create_cost',
        eventId: activeEventId,
        category: values.get('category'),
        description: values.get('description'),
        vendor: values.get('vendor'),
        amount: Number(values.get('amount')),
        status: values.get('status'),
        incurredOn: values.get('incurredOn'),
      }),
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setNotice(data.error || 'Could not add the event cost.');
      return;
    }
    form.reset();
    setNotice('Event cost added to the reconciled report');
    await loadReports();
  }

  async function voidEventCost(item: EventCost) {
    const reason =
      window.prompt('Why should this cost line be voided?')?.trim() || '';
    if (!reason) return;
    const response = await apiFetch('/api/reports', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'void_cost',
        id: item.id,
        version: item.version,
        reason,
      }),
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setNotice(data.error || 'Could not void this cost line.');
      await loadReports();
      return;
    }
    setNotice('Cost line voided with an audit reason');
    await loadReports();
  }

  async function exportReport(kind: string) {
    const response = await apiFetch(
      `/api/reports?export=${encodeURIComponent(kind)}${activeEventId ? `&eventId=${encodeURIComponent(activeEventId)}` : ''}`,
    );
    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      setNotice(data.error || 'Could not export this report.');
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${appContext?.workspace.slug || 'workspace'}-${kind}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setNotice(`${kind} CSV downloaded`);
  }

  async function selectEvent(id: string) {
    if (id) {
      const selected = events.find((item) => item.id === id);
      if (!selected || selected.status !== 'active') {
        setNotice('Activate the event after readiness passes before capture.');
        return;
      }
      try {
        const workspaceId =
          appContext?.workspace.id ||
          window.localStorage.getItem('revenue-workspace-id') ||
          '';
        if (!workspaceId) throw new Error('Workspace context is unavailable.');
        await cacheEventConfig(workspaceId, selected);
      } catch (error) {
        setNotice(
          error instanceof Error
            ? error.message
            : 'Could not cache the event configuration.',
        );
        return;
      }
      window.localStorage.setItem('revenue-event-id', id);
    } else window.localStorage.removeItem('revenue-event-id');
    setActiveEventId(id);
    setNotice(
      id
        ? 'Active event verified and cached for offline capture'
        : 'Active event cleared',
    );
    void loadWorkspace();
    void loadReports();
  }

  const activeEvent = events.find(
    (item) => item.id === activeEventId && item.status !== 'archived',
  );
  const reviewCaptureExtraction = captureExtraction(reviewLead?.extractedJson);
  const activeEventOpportunities = activeEvent
    ? opportunities.filter((item) => item.eventId === activeEvent.id)
    : opportunities;

  if (initializing)
    return (
      <main className="app-loading" aria-busy="true" aria-live="polite">
        <span className="brand-mark">
          <Sparkles size={18} />
        </span>
        <strong>Preparing your revenue workspace…</strong>
        <small>Loading the verified event, team and offline queue.</small>
      </main>
    );

  return (
    <main className="app-shell">
      <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
        <div className="brand">
          <span className="brand-mark">
            <Sparkles size={18} />
          </span>
          <span>Revenue OS</span>
        </div>
        <div className="workspace-switcher">
          <span className="workspace-logo">
            {appContext?.workspace.name
              .split(' ')
              .map((word) => word[0])
              .join('')
              .slice(0, 2) || 'NA'}
          </span>
          <span>
            <strong>{appContext?.workspace.name || 'Nova Automation'}</strong>
            <small>{appContext?.workspace.plan || 'Trial'} workspace</small>
          </span>
          <ChevronDown size={15} />
        </div>
        <nav aria-label="Main navigation">
          <p className="nav-label">Workspace</p>
          <NavItem
            icon={LayoutDashboard}
            label="Today"
            active={activeView === 'today'}
            onClick={() => go('today')}
          />
          <NavItem
            icon={Users}
            label="People & accounts"
            active={activeView === 'people'}
            onClick={() => go('people')}
          />
          <NavItem
            icon={Target}
            label="Opportunities"
            active={activeView === 'opportunities'}
            onClick={() => go('opportunities')}
          />
          <NavItem
            icon={FileText}
            label="RFQs & quotations"
            active={activeView === 'rfqs'}
            onClick={() => go('rfqs')}
          />
          <NavItem
            icon={CalendarDays}
            label="Meetings"
            active={activeView === 'meetings'}
            onClick={() => go('meetings')}
          />
          <p className="nav-label nav-label-spaced">Manage</p>
          <NavItem
            icon={CalendarDays}
            label="Events"
            active={activeView === 'events'}
            onClick={() => go('events')}
          />
          <NavItem
            icon={BarChart3}
            label="Revenue & ROI"
            active={activeView === 'roi'}
            onClick={() => go('roi')}
          />
          <NavItem
            icon={Building2}
            label="Company knowledge"
            active={activeView === 'knowledge'}
            onClick={() => go('knowledge')}
          />
          <NavItem
            icon={Settings}
            label="Workspace settings"
            active={activeView === 'settings'}
            onClick={() => go('settings')}
          />
        </nav>
        <div className="sidebar-foot">
          {outboxCount ? (
            <button
              type="button"
              className="sync-state sync-state-button sync-pending"
              onClick={() => void flushOutbox(true)}
              aria-label="Retry offline captures now"
            >
              <Wifi size={15} />
              <span>
                {outboxCount} capture{outboxCount === 1 ? '' : 's'} waiting
                {outboxNeedsReview
                  ? ` · ${outboxNeedsReview} need review`
                  : ' to sync'}{' '}
                · Retry now
              </span>
            </button>
          ) : (
            <div className="sync-state">
              <Wifi size={15} />
              <span>Online · All synced</span>
            </div>
          )}
          <div className="profile-row">
            <span className="profile-avatar">
              {(appContext?.user.email || 'AS').slice(0, 2).toUpperCase()}
            </span>
            <span>
              <strong>{appContext?.user.email || 'Local tester'}</strong>
              <small>{appContext?.role || 'Loading role'}</small>
            </span>
          </div>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <button
            className="mobile-menu"
            onClick={() => setMobileNav(!mobileNav)}
            aria-label="Toggle navigation"
          >
            <Menu />
          </button>
          <div className="event-context">
            <span className="live-dot" />{' '}
            {activeEvent?.name || 'No active event'}{' '}
            <span>
              ·{' '}
              {activeEvent
                ? `${activeEvent.venue || 'Venue pending'} · ${activeEvent.status}`
                : 'Select one in Events'}
            </span>
          </div>
          <div className="topbar-actions">
            <button
              className="search-button"
              aria-label="Search"
              onClick={() => setSearchOpen(true)}
            >
              <Search size={17} />
              <span>Search</span>
              <kbd>Ctrl K</kbd>
            </button>
            <button
              className="icon-button"
              aria-label="Profile"
              onClick={() => {
                setNotice('Signed in as Arjun Singh');
                setTimeout(() => setNotice(''), 1800);
              }}
            >
              <CircleUserRound size={21} />
            </button>
          </div>
        </header>

        <div className="content">
          {activeView === 'today' ? (
            <>
              <section className="welcome-row">
                <div>
                  <p className="eyebrow">
                    {new Intl.DateTimeFormat('en-US', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      timeZone: appContext?.workspace.timezone || 'UTC',
                    }).format(new Date())}
                  </p>
                  <h1>Good afternoon.</h1>
                  <p className="subtle">
                    {metrics.openTasks
                      ? `${metrics.openTasks} commitment${metrics.openTasks === 1 ? '' : 's'} ${metrics.openTasks === 1 ? 'needs' : 'need'} attention.`
                      : 'No open commitments need attention.'}
                  </p>
                </div>
                <Dialog open={captureOpen} onOpenChange={resetCapture}>
                  <DialogTrigger render={<Button className="capture-button" />}>
                    <Plus size={19} strokeWidth={2.4} /> Capture lead
                  </DialogTrigger>
                  <DialogContent
                    className="capture-dialog"
                    showCloseButton={!saved}
                  >
                    {!saved ? (
                      <>
                        <DialogHeader>
                          <p className="dialog-kicker">
                            {activeEvent?.name || 'Unassigned event'}
                          </p>
                          <DialogTitle className="dialog-title">
                            Capture a new conversation
                          </DialogTitle>
                          <DialogDescription>
                            Start with whatever the visitor gives you. Add the
                            conversation immediately after.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="capture-methods">
                          <button
                            type="button"
                            onClick={() => cardInput.current?.click()}
                          >
                            <Camera />
                            <span>
                              <strong>Upload card</strong>
                              <small>
                                Choose or photograph a visiting card
                              </small>
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => badgeInput.current?.click()}
                          >
                            <QrCode />
                            <span>
                              <strong>Upload badge</strong>
                              <small>Choose or photograph an event badge</small>
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => qrInput.current?.click()}
                          >
                            <QrCode />
                            <span>
                              <strong>Upload QR</strong>
                              <small>
                                Attach a visitor or campaign QR image
                              </small>
                            </span>
                          </button>
                          <button
                            type="button"
                            className={recording ? 'recording' : ''}
                            onClick={toggleRecording}
                          >
                            {recording ? <Square /> : <Mic />}
                            <span>
                              <strong>
                                {recording
                                  ? 'Stop recording'
                                  : 'Record conversation'}
                              </strong>
                              <small>
                                {recording
                                  ? 'Recording from your microphone…'
                                  : 'Capture the context that matters'}
                              </small>
                            </span>
                          </button>
                          <input
                            ref={cardInput}
                            className="capture-file-input"
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onInput={(event) => selectAttachment(event, 'card')}
                          />
                          <input
                            ref={badgeInput}
                            className="capture-file-input"
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onInput={(event) =>
                              selectAttachment(event, 'badge')
                            }
                          />
                          <input
                            ref={qrInput}
                            className="capture-file-input"
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onInput={(event) => selectAttachment(event, 'qr')}
                          />
                        </div>
                        <button
                          type="button"
                          className="demo-card-button"
                          onClick={loadDemoCard}
                        >
                          No card nearby? Try the clearly labelled sample card
                        </button>
                        {attachment ? (
                          <div className="attachment-preview">
                            {attachment.kind === 'audio' ? (
                              <audio
                                aria-label="Recorded conversation preview"
                                controls
                                src={attachment.url}
                              >
                                <track
                                  kind="captions"
                                  label="Transcript unavailable"
                                />
                              </audio>
                            ) : (
                              // oxlint-disable-next-line next/no-img-element -- Blob URLs are local previews and cannot use the image optimizer.
                              <img
                                src={attachment.url}
                                alt={`${attachment.kind} preview`}
                              />
                            )}
                            <span>
                              <strong>{attachment.name}</strong>
                              <small>
                                {attachment.name ===
                                'revenue-os-demo-card.png'
                                  ? 'Demo sample · automatic reading begins after save'
                                  : 'Original ready · automatic reading begins after save'}
                              </small>
                            </span>
                          </div>
                        ) : null}
                        <div className="or">
                          <span>or enter the basics</span>
                        </div>
                        <form
                          ref={leadForm}
                          onSubmit={saveLead}
                          className="lead-form"
                        >
                          <div className="field-grid">
                            <div className="field-block">
                              <label htmlFor="lead-name">Full name</label>
                              <Input
                                id="lead-name"
                                name="fullName"
                                required={!attachment}
                                placeholder={
                                  attachment
                                    ? 'Optional · extract from capture'
                                    : 'e.g. Rajesh Mehta'
                                }
                              />
                            </div>
                            <div className="field-block">
                              <label htmlFor="lead-company">Company</label>
                              <Input
                                id="lead-company"
                                name="company"
                                required={!attachment}
                                placeholder={
                                  attachment
                                    ? 'Optional · extract from capture'
                                    : 'e.g. ABC Pharma'
                                }
                              />
                            </div>
                          </div>
                          <div className="field-block">
                            <label htmlFor="lead-role">Role</label>
                            <Input
                              id="lead-role"
                              name="role"
                              placeholder="e.g. Procurement Head"
                            />
                          </div>
                          <div className="field-grid">
                            <div className="field-block">
                              <label htmlFor="lead-email">Work email</label>
                              <Input
                                id="lead-email"
                                name="email"
                                type="email"
                                autoComplete="email"
                                placeholder="rajesh@company.com"
                              />
                            </div>
                            <div className="field-block">
                              <label htmlFor="lead-phone">
                                Phone / WhatsApp
                              </label>
                              <Input
                                id="lead-phone"
                                name="phone"
                                type="tel"
                                autoComplete="tel"
                                placeholder="+91 98765 43210"
                              />
                            </div>
                          </div>
                          <fieldset className="field-block">
                            <legend>Follow-up permission</legend>
                            <label>
                              <input type="checkbox" name="emailConsent" />{' '}
                              Visitor clearly agreed to an email follow-up
                            </label>
                            <label>
                              <input type="checkbox" name="whatsappConsent" />{' '}
                              Visitor clearly agreed to a WhatsApp follow-up
                            </label>
                            <input
                              type="hidden"
                              name="consentSource"
                              value="event_conversation_attestation"
                            />
                            <small className="field-help">
                              Leave unchecked if permission was not clearly
                              given. The system will block message drafting
                              until it is recorded.
                            </small>
                          </fieldset>
                          <div className="field-block">
                            <label htmlFor="lead-note">Conversation note</label>
                            <Textarea
                              id="lead-note"
                              name="note"
                              placeholder="What did they need, what did you promise, and when?"
                            />
                          </div>
                          <div className="field-grid">
                            <div className="field-block">
                              <label htmlFor="lead-action">Next action</label>
                              <Input
                                id="lead-action"
                                name="nextAction"
                                placeholder="e.g. Send preliminary pricing"
                              />
                            </div>
                            <div className="field-block">
                              <label htmlFor="lead-due">Due date</label>
                              <Input id="lead-due" name="dueDate" type="date" />
                            </div>
                          </div>
                          {saveError ? (
                            <p className="form-error" role="alert">
                              {saveError}
                            </p>
                          ) : null}
                          <Button
                            type="submit"
                            className="save-button"
                            disabled={saving || !activeEvent}
                          >
                            {saving
                              ? captureProgress || 'Saving securely…'
                              : !activeEvent
                                ? 'Create or select an event before capture'
                                : attachment
                                  ? 'Save and read capture'
                                  : 'Save conversation'}{' '}
                            {!saving && activeEvent && <ArrowRight />}
                          </Button>
                          <p className="offline-note">
                            <Wifi size={14} /> Offline-safe. Failed submissions
                            stay on this device and retry when connection
                            returns.
                          </p>
                        </form>
                      </>
                    ) : (
                      <div className="success-state">
                        <span className="success-icon">
                          <Check />
                        </span>
                        <p className="dialog-kicker">
                          {savedLead?.reviewStatus === 'queued_offline'
                            ? 'Saved on this device'
                            : 'Lead saved'}
                        </p>
                        <DialogTitle className="dialog-title">
                          {savedLead?.fullName} is{' '}
                          {savedLead?.reviewStatus === 'queued_offline'
                            ? 'waiting to sync'
                            : 'ready for review'}
                        </DialogTitle>
                        <DialogDescription>
                          {captureOutcome
                            ? captureOutcome
                            : savedLead?.reviewStatus === 'queued_offline'
                            ? 'Keep working. Revenue OS will retry this exact capture without creating duplicates when the connection returns.'
                            : attachment
                              ? 'The original file is stored securely. Review the contact before any extracted detail becomes a confirmed fact.'
                              : 'The conversation is stored as source evidence. No facts have been invented.'}
                        </DialogDescription>
                        <div className="saved-summary">
                          <span>
                            <small>Account</small>
                            <strong>{savedLead?.company}</strong>
                          </span>
                          <span>
                            <small>Review</small>
                            <strong>
                              {savedLead?.reviewStatus === 'queued_offline'
                                ? 'Offline queue'
                                : 'Needs review'}
                            </strong>
                          </span>
                          {savedLead?.nextAction ? (
                            <span>
                              <small>Commitment</small>
                              <strong>{savedLead.nextAction}</strong>
                            </span>
                          ) : null}
                          {savedLead?.dueDate ? (
                            <span>
                              <small>Due</small>
                              <strong>{savedLead.dueDate}</strong>
                            </span>
                          ) : null}
                        </div>
                        {captureOutcome && savedLead ? (
                          <Button
                            className="save-button"
                            onClick={() => {
                              const lead = savedLead;
                              resetCapture(false);
                              setTimeout(() => openReview(lead), 180);
                            }}
                          >
                            Review manually
                          </Button>
                        ) : null}
                        <Button
                          variant={captureOutcome ? 'outline' : 'default'}
                          className={captureOutcome ? undefined : 'save-button'}
                          onClick={() => resetCapture(false)}
                        >
                          Back to today
                        </Button>
                      </div>
                    )}
                  </DialogContent>
                </Dialog>
                <Dialog
                  open={Boolean(reviewLead)}
                  onOpenChange={(open) => {
                    if (!open) {
                      setReviewLead(null);
                      setAcceptedCaptureFields([]);
                    }
                  }}
                >
                  <DialogContent className="review-dialog">
                    <DialogHeader>
                      <p className="dialog-kicker">Conversation intelligence</p>
                      <DialogTitle className="dialog-title">
                        {reviewLead?.captureStatus ===
                          'completed_pending_review'
                          ? `Review ${reviewLead.captureKind || 'uploaded'} capture`
                          : `Review ${reviewLead?.fullName}`}
                      </DialogTitle>
                      <DialogDescription>
                        AI suggestions remain separate from confirmed customer
                        facts until you approve them.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="source-note">
                      <span>Source conversation</span>
                      <p>
                        {reviewLead?.note ||
                          'No conversation note was captured.'}
                      </p>
                    </div>
                    {reviewLead?.captureStatus ? (
                      <div
                        className={`capture-status ${reviewLead.captureStatus}`}
                      >
                        <span>
                          <strong>
                            {reviewLead.captureKind?.toUpperCase()} capture
                          </strong>
                          <small>
                            {reviewLead.captureStatus === 'confirmed'
                              ? 'Reviewed · verified fields saved'
                              : reviewLead.captureStatus ===
                                  'completed_pending_review'
                                ? 'Processed · verify every suggestion below'
                                : reviewLead.captureStatus === 'failed'
                                  ? 'Processing failed · original retained'
                                  : 'Original stored · ready for processing'}
                          </small>
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={processCapture}
                          disabled={
                            extractingCapture ||
                            ['completed_pending_review', 'confirmed'].includes(
                              reviewLead.captureStatus,
                            )
                          }
                        >
                          {extractingCapture
                            ? 'Processing…'
                            : reviewLead.captureStatus === 'confirmed'
                              ? 'Reviewed'
                              : reviewLead.captureStatus ===
                                  'completed_pending_review'
                                ? 'Awaiting review'
                                : 'Extract details'}
                        </Button>
                      </div>
                    ) : null}
                    {reviewCaptureExtraction ? (
                      <div className="extraction-evidence">
                        <strong>
                          Machine-read suggestions ·{' '}
                          {Math.round(reviewCaptureExtraction.confidence * 100)}
                          %{' overall confidence'}
                        </strong>
                        {reviewCaptureExtraction.warnings.length ? (
                          <span>
                            {reviewCaptureExtraction.warnings.join(' · ')}
                          </span>
                        ) : (
                          <span>
                            No extraction warnings. Human verification is still
                            required.
                          </span>
                        )}
                      </div>
                    ) : null}
                    {reviewLead ? (
                      <form
                        className="lead-form review-contact-form"
                        ref={reviewContactForm}
                        onSubmit={saveLeadDetails}
                        key={`${reviewLead.id}-${reviewLead.captureStatus}`}
                      >
                        <h3>Verified contact details</h3>
                        {reviewLead.captureStatus ===
                          'completed_pending_review' &&
                        reviewCaptureExtraction ? (
                          <div className="capture-suggestions">
                            {(
                              [
                                ['fullName', 'Full name'],
                                ['company', 'Company'],
                                ['role', 'Role'],
                                ['email', 'Email'],
                                ['phone', 'Phone'],
                              ] as const
                            ).map(([field, label]) => {
                              const value = reviewCaptureExtraction[field];
                              if (!value) return null;
                              const applied =
                                acceptedCaptureFields.includes(field);
                              const confidence =
                                reviewCaptureExtraction.fieldConfidence?.[
                                  field
                                ] ?? reviewCaptureExtraction.confidence;
                              return (
                                <div key={field}>
                                  <span>
                                    <small>{label}</small>
                                    <strong>{value}</strong>
                                    <small>
                                      {Math.round(confidence * 100)}% confidence
                                    </small>
                                  </span>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() =>
                                      applyCaptureSuggestion(field, value)
                                    }
                                  >
                                    {applied ? 'Applied' : 'Use suggestion'}
                                  </Button>
                                </div>
                              );
                            })}
                            {reviewCaptureExtraction.transcript ? (
                              <div>
                                <span>
                                  <small>Audio transcript</small>
                                  <strong>
                                    {reviewCaptureExtraction.transcript.slice(
                                      0,
                                      180,
                                    )}
                                  </strong>
                                  <small>
                                    {Math.round(
                                      (reviewCaptureExtraction.fieldConfidence
                                        ?.transcript ??
                                        reviewCaptureExtraction.confidence) *
                                        100,
                                    )}
                                    % confidence
                                  </small>
                                </span>
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() =>
                                    setAcceptedCaptureFields((current) =>
                                      current.includes('transcript')
                                        ? current.filter(
                                            (item) => item !== 'transcript',
                                          )
                                        : [...current, 'transcript'],
                                    )
                                  }
                                >
                                  {acceptedCaptureFields.includes('transcript')
                                    ? 'Will add as evidence'
                                    : 'Add as evidence'}
                                </Button>
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                        <div className="field-grid">
                          <div className="field-block">
                            <label htmlFor="review-name">Full name</label>
                            <input
                              className="review-input"
                              id="review-name"
                              name="fullName"
                              defaultValue={
                                reviewCaptureExtraction?.fullName ||
                                (reviewLead.fullName === 'Unidentified visitor'
                                  ? ''
                                  : reviewLead.fullName)
                              }
                              onChange={() =>
                                markCaptureCorrection('fullName')
                              }
                              required
                            />
                          </div>
                          <div className="field-block">
                            <label htmlFor="review-company">Company</label>
                            <input
                              className="review-input"
                              id="review-company"
                              name="company"
                              defaultValue={
                                reviewCaptureExtraction?.company ||
                                (reviewLead.company === 'Company pending'
                                  ? ''
                                  : reviewLead.company)
                              }
                              onChange={() =>
                                markCaptureCorrection('company')
                              }
                              required
                            />
                          </div>
                        </div>
                        <div className="field-grid">
                          <input
                            className="review-input"
                            name="role"
                            aria-label="Verified role"
                            defaultValue={
                              reviewCaptureExtraction?.role ||
                              reviewLead.role ||
                              ''
                            }
                            onChange={() => markCaptureCorrection('role')}
                            placeholder="Role"
                          />
                          <input
                            className="review-input"
                            name="email"
                            aria-label="Verified work email"
                            type="text"
                            inputMode="email"
                            defaultValue=""
                            onChange={() => markCaptureCorrection('email')}
                            placeholder="Work email"
                          />
                        </div>
                        <input
                          className="review-input"
                          name="phone"
                          aria-label="Verified phone"
                          type="text"
                          inputMode="tel"
                          defaultValue=""
                          onChange={() => markCaptureCorrection('phone')}
                          placeholder="Phone / WhatsApp"
                        />
                        <Button type="submit" variant="outline">
                          {reviewLead.captureStatus ===
                          'completed_pending_review'
                            ? 'Confirm review and save'
                            : 'Save verified details'}
                        </Button>
                        <div className="field-grid">
                          <div>
                            <small>
                              Email permission:{' '}
                              {reviewLead.emailConsentStatus || 'not recorded'}
                            </small>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() =>
                                setContactPermission(
                                  'email',
                                  reviewLead.emailConsentStatus === 'granted'
                                    ? 'withdrawn'
                                    : 'granted',
                                )
                              }
                            >
                              {reviewLead.emailConsentStatus === 'granted'
                                ? 'Withdraw email permission'
                                : 'Record email permission'}
                            </Button>
                          </div>
                          <div>
                            <small>
                              WhatsApp permission:{' '}
                              {reviewLead.whatsappConsentStatus ||
                                'not recorded'}
                            </small>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() =>
                                setContactPermission(
                                  'whatsapp',
                                  reviewLead.whatsappConsentStatus === 'granted'
                                    ? 'withdrawn'
                                    : 'granted',
                                )
                              }
                            >
                              {reviewLead.whatsappConsentStatus === 'granted'
                                ? 'Withdraw WhatsApp permission'
                                : 'Record WhatsApp permission'}
                            </Button>
                          </div>
                        </div>
                      </form>
                    ) : null}
                    {reviewLead?.duplicateLeadId ? (
                      <div className="ai-config-warning">
                        <strong>Possible duplicate contact</strong>
                        <span>
                          This may already exist as{' '}
                          {reviewLead.duplicateLeadName} at{' '}
                          {reviewLead.duplicateLeadCompany ||
                            reviewLead.company}
                          . Review both records before merging.
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => mergeDuplicateLead(reviewLead)}
                          disabled={
                            !['owner', 'admin', 'manager'].includes(
                              appContext?.role || '',
                            )
                          }
                        >
                          Merge into existing contact
                        </Button>
                      </div>
                    ) : null}
                    {reviewLead ? (
                      <form
                        className="lead-form task-quick-add"
                        onSubmit={updateQualification}
                      >
                        <h3>
                          Qualification ·{' '}
                          {reviewLead.qualificationState || 'unqualified'}
                        </h3>
                        <div className="field-grid">
                          <select
                            name="state"
                            defaultValue={
                              reviewLead.qualificationState || 'unqualified'
                            }
                          >
                            <option value="hot">Hot</option>
                            <option value="warm">Warm</option>
                            <option value="cold">Cold</option>
                            <option value="unqualified">Unqualified</option>
                          </select>
                          <Input
                            name="reason"
                            required
                            defaultValue={reviewLead.qualificationReason || ''}
                            placeholder="Reason for this classification"
                          />
                        </div>
                        <Button type="submit" variant="outline">
                          Record qualification
                        </Button>
                      </form>
                    ) : null}
                    {reviewLead &&
                    ['owner', 'admin', 'manager'].includes(
                      appContext?.role || '',
                    ) ? (
                      <form
                        className="lead-form task-quick-add"
                        onSubmit={assignLeadOwner}
                      >
                        <h3>
                          Lead owner ·{' '}
                          {reviewLead.ownerName ||
                            reviewLead.ownerId ||
                            'Unassigned'}
                        </h3>
                        <div className="field-grid">
                          <select
                            name="ownerId"
                            defaultValue={reviewLead.ownerId || ''}
                            required
                          >
                            <option value="" disabled>
                              Select owner
                            </option>
                            {members
                              .filter((member) => member.status === 'active')
                              .map((member) => (
                                <option key={member.id} value={member.userId}>
                                  {member.displayName ||
                                    member.email ||
                                    member.role}
                                </option>
                              ))}
                          </select>
                          <Input
                            name="reason"
                            placeholder="Assignment reason"
                            defaultValue="manager_assignment"
                          />
                        </div>
                        <Button type="submit" variant="outline">
                          Assign owner
                        </Button>
                      </form>
                    ) : null}
                    <div className="stakeholder-control">
                      <span>
                        <strong>Buying-committee role</strong>
                        <small>
                          Link this person’s influence to the shared company
                          account.
                        </small>
                      </span>
                      <select
                        aria-label="Buying-committee role"
                        value={reviewLead?.buyingRole || 'unknown'}
                        onChange={(event) =>
                          setStakeholderRole(event.target.value)
                        }
                      >
                        <option value="unknown">Not classified</option>
                        <option value="buyer">Buyer</option>
                        <option value="technical_evaluator">
                          Technical evaluator
                        </option>
                        <option value="internal_champion">
                          Internal champion
                        </option>
                        <option value="decision_maker">Decision-maker</option>
                        <option value="influencer">Influencer</option>
                        <option value="user">End user</option>
                      </select>
                    </div>
                    {reviewLead ? (
                      <form
                        className="lead-form task-quick-add"
                        onSubmit={createLeadTask}
                      >
                        <h3>Add a commitment</h3>
                        <div className="field-grid">
                          <Input
                            name="title"
                            required
                            placeholder="Next action"
                            aria-label="New commitment"
                          />
                          <Input
                            name="dueDate"
                            type="date"
                            aria-label="Commitment due date"
                          />
                        </div>
                        <Button type="submit" variant="outline">
                          Create task
                        </Button>
                      </form>
                    ) : null}
                    {reviewLead &&
                    ['owner', 'admin'].includes(appContext?.role || '') ? (
                      <button
                        className="privacy-erase"
                        type="button"
                        onClick={eraseLead}
                      >
                        <Trash2 /> Erase personal data
                      </button>
                    ) : null}
                    {!analysis ? (
                      <div className="analysis-empty">
                        <span className="analysis-mark">
                          <Sparkles />
                        </span>
                        <h3>Turn this note into accountable sales data</h3>
                        <p>
                          Extract requirements, buying signals, commitments,
                          deadlines, and supporting evidence.
                        </p>
                        {analysisError ? (
                          <div className="ai-config-warning">
                            <strong>AI analysis unavailable</strong>
                            <span>{analysisError}</span>
                          </div>
                        ) : null}
                        <Button
                          onClick={analyzeConversation}
                          disabled={analyzing || !reviewLead?.note}
                        >
                          {analyzing
                            ? 'Analyzing evidence…'
                            : 'Analyze conversation'}{' '}
                          <Sparkles />
                        </Button>
                      </div>
                    ) : (
                      <div className="analysis-result">
                        <div className="analysis-summary">
                          <span className="analysis-score">
                            {analysis.score.value}
                          </span>
                          <div>
                            <small>AI qualification score · explainable</small>
                            <p>{analysis.summary}</p>
                          </div>
                        </div>
                        <div className="intelligence-grid">
                          {analysis.fields
                            .filter((field) => field.value)
                            .map((field) => (
                              <article key={field.key}>
                                <span>
                                  {field.label}
                                  <i>{Math.round(field.confidence * 100)}%</i>
                                </span>
                                <strong>{field.value}</strong>
                                {field.evidence ? (
                                  <q>{field.evidence}</q>
                                ) : null}
                              </article>
                            ))}
                        </div>
                        {analysis.commitments.length ? (
                          <div className="commitments">
                            <h3>Proposed commitments</h3>
                            {analysis.commitments.map((item, index) => (
                              <article key={`${item.title}-${index}`}>
                                <Clock3 />
                                <span>
                                  <strong>{item.title}</strong>
                                  <label>
                                    <small>
                                      Confirmed deadline · {item.owner_party}
                                    </small>
                                    <Input
                                      aria-label={`Deadline for ${item.title}`}
                                      type="date"
                                      value={item.due_date || ''}
                                      onChange={(event) =>
                                        setAnalysis((current) =>
                                          current
                                            ? {
                                                ...current,
                                                commitments:
                                                  current.commitments.map(
                                                    (commitment, position) =>
                                                      position === index
                                                        ? {
                                                            ...commitment,
                                                            due_date:
                                                              event.target
                                                                .value || null,
                                                          }
                                                        : commitment,
                                                  ),
                                              }
                                            : current,
                                        )
                                      }
                                      required
                                    />
                                  </label>
                                  <q>{item.evidence}</q>
                                </span>
                              </article>
                            ))}
                          </div>
                        ) : null}
                        {analysis.risks.length ? (
                          <div className="risk-note">
                            <strong>Needs attention</strong>
                            {analysis.risks.join(' · ')}
                          </div>
                        ) : null}
                        {analysisError ? (
                          <p className="form-error" role="alert">
                            {analysisError}
                          </p>
                        ) : null}
                        <Button
                          className="save-button"
                          onClick={confirmAnalysis}
                          disabled={
                            confirmed ||
                            analysis.commitments.some((item) => !item.due_date)
                          }
                        >
                          {confirmed ? (
                            <>
                              <Check /> Confirmed and tasks created
                            </>
                          ) : analysis.commitments.some(
                              (item) => !item.due_date,
                            ) ? (
                            'Confirm commitment dates first'
                          ) : (
                            'Confirm facts and create tasks'
                          )}
                        </Button>
                      </div>
                    )}
                    {confirmed || reviewLead?.reviewStatus === 'confirmed' ? (
                      <section className="followup-composer">
                        <div>
                          <span>
                            <h3>Personalized follow-up</h3>
                            <p>
                              AI drafts from confirmed facts only. Any edit
                              resets approval. Approval never sends the message.
                            </p>
                          </span>
                          <div className="followup-buttons">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => generateFollowup('email')}
                              disabled={Boolean(drafting)}
                            >
                              {drafting === 'email'
                                ? 'Drafting…'
                                : 'Draft email'}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => generateFollowup('whatsapp')}
                              disabled={Boolean(drafting)}
                            >
                              {drafting === 'whatsapp'
                                ? 'Drafting…'
                                : 'Draft WhatsApp'}
                            </Button>
                            <Button
                              type="button"
                              onClick={() => {
                                setOpportunityLead(reviewLead);
                                setReviewLead(null);
                                setOpportunityOpen(true);
                              }}
                            >
                              Create opportunity
                            </Button>
                          </div>
                        </div>
                        {analysisError ? (
                          <p className="form-error" role="alert">
                            {analysisError}
                          </p>
                        ) : null}
                        {followups.map((draft) => (
                          <article key={draft.id}>
                            <span>
                              <b>{draft.channel}</b>
                              <small>
                                To {draft.recipient} · {draft.status} · v
                                {draft.version}
                              </small>
                            </span>
                            <form
                              className="lead-form"
                              onSubmit={(event) => editFollowup(event, draft)}
                            >
                              {draft.channel === 'email' ? (
                                <Input
                                  name="subject"
                                  defaultValue={draft.subject || ''}
                                  aria-label="Follow-up subject"
                                />
                              ) : (
                                <input type="hidden" name="subject" value="" />
                              )}
                              <Textarea
                                name="message"
                                defaultValue={draft.body}
                                aria-label="Follow-up message"
                                required
                              />
                              <div>
                                <Button type="submit" variant="outline">
                                  Save edits
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() =>
                                    navigator.clipboard.writeText(draft.body)
                                  }
                                >
                                  Copy
                                </Button>
                                {draft.status === 'approved' ? (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => openApprovedFollowup(draft)}
                                  >
                                    Open{' '}
                                    {draft.channel === 'email'
                                      ? 'email'
                                      : 'WhatsApp'}
                                  </Button>
                                ) : null}
                                <Button
                                  type="button"
                                  onClick={() => approveFollowup(draft)}
                                  disabled={draft.status !== 'draft'}
                                >
                                  {draft.status === 'approved' ? (
                                    <>
                                      <Check /> Approved
                                    </>
                                  ) : (
                                    'Approve draft'
                                  )}
                                </Button>
                              </div>
                            </form>
                          </article>
                        ))}
                      </section>
                    ) : null}
                  </DialogContent>
                </Dialog>
              </section>

              <section className="signal-grid" aria-label="Event performance">
                <article className="signal-card primary-signal">
                  <div className="signal-head">
                    <span>Captured leads</span>
                    <span className="trend">Live</span>
                  </div>
                  <strong>{metrics.totalLeads}</strong>
                  <small>
                    {metrics.qualifiedLeads} confirmed conversations
                  </small>
                  <div className="spark-bars" aria-hidden="true">
                    {[32, 44, 37, 58, 49, 70, 63, 82, 76, 91].map((h, i) => (
                      <i key={i} style={{ height: `${h}%` }} />
                    ))}
                  </div>
                </article>
                <article className="signal-card">
                  <div className="signal-head">
                    <span>Open promises</span>
                    <span className="mini-icon amber">
                      <Clock3 />
                    </span>
                  </div>
                  <strong>{metrics.openTasks}</strong>
                  <small>
                    Complete, remind or cancel with a recorded reason
                  </small>
                  <div className="progress-track">
                    <i
                      style={{
                        width: `${Math.min(100, metrics.openTasks * 12)}%`,
                      }}
                    />
                  </div>
                </article>
                <article className="signal-card">
                  <div className="signal-head">
                    <span>Event pipeline</span>
                    <span className="mini-icon blue">
                      <Target />
                    </span>
                  </div>
                  <strong>
                    {money(
                      metrics.pipelineValue,
                      appContext?.workspace.currency,
                    )}
                  </strong>
                  <small>
                    Across {activeEventOpportunities.length} opportunit
                    {activeEventOpportunities.length === 1 ? 'y' : 'ies'}
                  </small>
                  <div className="pipeline-note">
                    <span>{metrics.qualifiedLeads}</span> qualified leads
                  </div>
                </article>
              </section>

              <section className="main-grid">
                <article className="panel action-panel">
                  <div className="panel-head">
                    <div>
                      <p className="eyebrow">Next best action</p>
                      <h2>What needs attention</h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowAllTasks((value) => !value)}
                    >
                      {showAllTasks ? 'Show priority' : 'View all'}{' '}
                      <ArrowRight />
                    </button>
                  </div>
                  <div className="action-list">
                    {!showAllTasks && nextBestActions.length
                      ? nextBestActions.slice(0, 5).map((action) => (
                          <article
                            className="action-row task-row"
                            key={`priority-${action.kind}-${action.id}`}
                          >
                            <span className="initial-avatar">
                              {action.kind.slice(0, 2).toUpperCase()}
                            </span>
                            <span className="action-copy">
                              <strong>{action.title}</strong>
                              <small>
                                {action.subject} · {action.reason}
                              </small>
                            </span>
                            <span
                              className={`due ${action.priority >= 94 ? 'urgent' : ''}`}
                            >
                              P{action.priority}
                            </span>
                          </article>
                        ))
                      : null}
                    {(showAllTasks || !nextBestActions.length) &&
                    tasks.filter((task) => task.status === 'open').length ? (
                      tasks
                        .filter((task) => task.status === 'open')
                        .slice(0, showAllTasks ? tasks.length : 5)
                        .map((task) => {
                          const due = dueStatus(
                            task.dueDate,
                            appContext?.workspace.timezone || 'UTC',
                          );
                          const reminderDue = Boolean(
                            task.reminderAt && task.reminderAt <= clockNow,
                          );
                          return (
                            <article
                              className="action-row task-row"
                              key={task.id}
                            >
                              <span className="initial-avatar">
                                {task.fullName
                                  .split(' ')
                                  .map((word) => word[0])
                                  .join('')
                                  .slice(0, 2)}
                              </span>
                              <span className="action-copy">
                                <strong>{task.title}</strong>
                                <small>
                                  {task.fullName} · {task.company}
                                  {task.reminderAt
                                    ? ` · ${reminderDue ? 'Reminder due' : `Reminder ${new Date(task.reminderAt).toLocaleString()}`}`
                                    : ''}
                                </small>
                              </span>
                              <span
                                className={`due ${reminderDue ? 'urgent' : due.tone}`}
                              >
                                {reminderDue ? 'Reminder due' : due.label}
                              </span>
                              <span className="task-actions">
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() => updateTask(task, 'complete')}
                                >
                                  Complete
                                </Button>
                                {task.reminderAt ? (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() =>
                                      updateTask(task, 'clear_reminder')
                                    }
                                  >
                                    Clear reminder
                                  </Button>
                                ) : (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() =>
                                      updateTask(task, 'schedule_reminder')
                                    }
                                  >
                                    Remind tomorrow
                                  </Button>
                                )}
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() => updateTask(task, 'cancel')}
                                >
                                  Cancel
                                </Button>
                              </span>
                            </article>
                          );
                        })
                    ) : !nextBestActions.length ? (
                      <div className="empty-state">
                        No open commitments. Capture a lead and add a next
                        action.
                      </div>
                    ) : null}
                    {tasks.some((task) => task.status !== 'open') ? (
                      <details className="closed-tasks">
                        <summary>Recently closed commitments</summary>
                        {tasks
                          .filter((task) => task.status !== 'open')
                          .slice(0, 5)
                          .map((task) => (
                            <article key={task.id}>
                              <span>
                                <strong>{task.title}</strong>
                                <small>
                                  {task.fullName} · {task.status}
                                  {task.cancellationReason
                                    ? ` · ${task.cancellationReason}`
                                    : ''}
                                </small>
                              </span>
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => updateTask(task, 'reopen')}
                              >
                                Reopen
                              </Button>
                            </article>
                          ))}
                      </details>
                    ) : null}
                  </div>
                </article>
                <article className="panel briefing-panel">
                  <div className="ai-label">
                    <Sparkles size={14} /> Workspace briefing
                  </div>
                  <h2>
                    {metrics.totalLeads
                      ? `${metrics.totalLeads} conversations captured, with ${metrics.qualifiedLeads} confirmed.`
                      : 'Capture the first conversation to start the briefing.'}
                  </h2>
                  <p>
                    {metrics.openTasks
                      ? `${metrics.openTasks} customer commitment${metrics.openTasks === 1 ? '' : 's'} ${metrics.openTasks === 1 ? 'remains' : 'remain'} open. Prioritize dated tasks first.`
                      : 'There are no open customer commitments. The briefing only reports current workspace data.'}
                  </p>
                  <button onClick={() => go('people')}>
                    Review accounts <ArrowRight />
                  </button>
                  <div className="briefing-orb" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                  </div>
                </article>
              </section>

              <section className="panel leads-panel">
                <div className="panel-head">
                  <div>
                    <p className="eyebrow">Live from the booth</p>
                    <h2>Recent conversations</h2>
                  </div>
                  <button>
                    See all leads <ArrowRight />
                  </button>
                </div>
                <div className="lead-table" aria-label="Recent conversations">
                  <div className="lead-row lead-header">
                    <span>Person</span>
                    <span>Interest</span>
                    <span>AI score</span>
                    <span>Captured</span>
                  </div>
                  {capturedLeads.map((lead) => (
                    <button
                      className="lead-row new-lead"
                      key={lead.id}
                      onClick={() => openReview(lead)}
                    >
                      <span className="person-cell">
                        <span className="initial-avatar small">
                          {lead.fullName
                            .split(' ')
                            .map((n) => n[0])
                            .join('')
                            .slice(0, 2)}
                        </span>
                        <span>
                          <strong>{lead.fullName}</strong>
                          <small>
                            {lead.role || 'Role not added'} · {lead.company}
                          </small>
                        </span>
                      </span>
                      <span>{lead.nextAction || 'Needs review'}</span>
                      <span>
                        {typeof lead.score === 'number' ? (
                          <b
                            className={`score ${lead.score >= 70 ? 'hot' : ''}`}
                            title={
                              lead.scoreRationale ||
                              'Confirmed qualification score'
                            }
                          >
                            {lead.score}
                          </b>
                        ) : (
                          <b
                            className={`review-chip ${lead.reviewStatus === 'confirmed' ? 'confirmed' : ''}`}
                          >
                            {lead.reviewStatus === 'confirmed'
                              ? 'Confirmed'
                              : 'Review'}
                          </b>
                        )}
                      </span>
                      <span>
                        {new Intl.DateTimeFormat('en-US', {
                          month: 'short',
                          day: 'numeric',
                          timeZone: appContext?.workspace.timezone || 'UTC',
                        }).format(new Date(lead.createdAt))}
                      </span>
                    </button>
                  ))}
                  {!capturedLeads.length ? (
                    <div className="empty-state">
                      No conversations captured in this workspace yet.
                    </div>
                  ) : null}
                </div>
              </section>
            </>
          ) : (
            <section className="section-view">
              <div className="section-title">
                <div>
                  <p className="eyebrow">Revenue workspace</p>
                  <h1>
                    {activeView === 'people'
                      ? 'People & accounts'
                      : activeView === 'opportunities'
                        ? 'Opportunities'
                        : activeView === 'rfqs'
                          ? 'RFQs & quotations'
                          : activeView === 'meetings'
                            ? 'Meetings'
                            : activeView === 'events'
                              ? 'Events'
                              : activeView === 'roi'
                                ? 'Revenue & ROI'
                                : activeView === 'settings'
                                  ? 'Workspace settings'
                                  : 'Company knowledge'}
                  </h1>
                </div>
                {activeView === 'opportunities' ? (
                  <Button
                    className="capture-button"
                    onClick={() => {
                      setOpportunityLead(null);
                      setOpportunityOpen(true);
                    }}
                  >
                    <Plus /> New opportunity
                  </Button>
                ) : null}
              </div>
              {activeView === 'people' ? (
                <div className="records-grid">
                  <article className="panel records-panel">
                    <h2>Accounts</h2>
                    {accounts.length ? (
                      accounts.map((account) => (
                        <button key={account.id} className="record-row">
                          <span className="initial-avatar">
                            {account.company
                              .split(' ')
                              .map((word) => word[0])
                              .join('')
                              .slice(0, 2)}
                          </span>
                          <span>
                            <strong>{account.company}</strong>
                            <small>
                              {account.contacts} contact
                              {account.contacts === 1 ? '' : 's'} ·{' '}
                              {account.stakeholders || 0} classified
                            </small>
                          </span>
                          <ArrowRight />
                        </button>
                      ))
                    ) : (
                      <div className="empty-state">
                        Capture a lead to create the first account.
                      </div>
                    )}
                  </article>
                  <article className="panel records-panel">
                    <h2>Contacts</h2>
                    {capturedLeads.length ? (
                      capturedLeads.map((lead) => (
                        <button
                          key={lead.id}
                          className="record-row"
                          onClick={() => openReview(lead)}
                        >
                          <span className="initial-avatar">
                            {lead.fullName
                              .split(' ')
                              .map((word) => word[0])
                              .join('')
                              .slice(0, 2)}
                          </span>
                          <span>
                            <strong>{lead.fullName}</strong>
                            <small>
                              {lead.role || 'Role not added'} · {lead.company}
                            </small>
                          </span>
                          <b className="review-chip">
                            {lead.buyingRole?.replaceAll('_', ' ') ||
                              'Classify'}
                          </b>
                        </button>
                      ))
                    ) : (
                      <div className="empty-state">
                        No captured contacts yet.
                      </div>
                    )}
                  </article>
                </div>
              ) : null}
              {activeView === 'opportunities' ? (
                <article className="panel data-panel">
                  {opportunities.length ? (
                    <>
                      <div className="data-header">
                        <span>Opportunity</span>
                        <span>Stage</span>
                        <span>Value</span>
                        <span>Probability</span>
                      </div>
                      {opportunities.map((item) => (
                        <div className="data-row opportunity-row" key={item.id}>
                          <span>
                            <strong>{item.title}</strong>
                            <small>{item.company}</small>
                            <small>
                              {item.contacts.length
                                ? item.contacts
                                    .map((contact) => contact.fullName)
                                    .join(' · ')
                                : 'No stakeholders linked'}
                            </small>
                            {item.lossReason ? (
                              <small className="form-error">
                                Lost: {item.lossReason}
                              </small>
                            ) : null}
                            <span className="opportunity-contact-actions">
                              {item.contacts.map((contact) => (
                                <button
                                  type="button"
                                  key={contact.leadId}
                                  onClick={() =>
                                    changeOpportunityContact(
                                      item,
                                      contact.leadId,
                                      'remove',
                                    )
                                  }
                                  title={`Remove ${contact.fullName}`}
                                >
                                  {contact.fullName} ×
                                </button>
                              ))}
                              <select
                                aria-label={`Add stakeholder to ${item.title}`}
                                defaultValue=""
                                onChange={(event) => {
                                  if (event.target.value) {
                                    void changeOpportunityContact(
                                      item,
                                      event.target.value,
                                      'add',
                                    );
                                    event.target.value = '';
                                  }
                                }}
                              >
                                <option value="">+ Add stakeholder</option>
                                {capturedLeads
                                  .filter(
                                    (lead) =>
                                      lead.company === item.company &&
                                      !item.contacts.some(
                                        (contact) => contact.leadId === lead.id,
                                      ),
                                  )
                                  .map((lead) => (
                                    <option key={lead.id} value={lead.id}>
                                      {lead.fullName} ·{' '}
                                      {lead.buyingRole ||
                                        lead.role ||
                                        'Contact'}
                                    </option>
                                  ))}
                              </select>
                            </span>
                          </span>
                          <select
                            className="stage-select"
                            aria-label={`Stage for ${item.title}`}
                            value={item.stage}
                            onChange={(event) =>
                              updateOpportunityStage(item, event.target.value)
                            }
                          >
                            <option value="qualified">Qualified</option>
                            <option value="requirement">Requirement</option>
                            <option value="sample">Sample</option>
                            <option value="rfq">RFQ</option>
                            <option value="quotation">Quotation</option>
                            <option value="meeting">Meeting</option>
                            <option value="negotiation">Negotiation</option>
                            <option value="won">Won</option>
                            <option value="lost">Lost</option>
                          </select>
                          <button
                            className="value-button"
                            type="button"
                            onClick={() => changeOpportunityValue(item)}
                            title="Update value with history"
                          >
                            {money(item.value, item.currency)}
                          </button>
                          <span>{item.probability}%</span>
                        </div>
                      ))}
                    </>
                  ) : (
                    <div className="empty-state large">
                      <Target />
                      <h2>No opportunities yet</h2>
                      <p>
                        Convert a qualified conversation into your first
                        pipeline record.
                      </p>
                      <Button onClick={() => setOpportunityOpen(true)}>
                        Create opportunity
                      </Button>
                    </div>
                  )}
                </article>
              ) : null}
              {activeView === 'rfqs' ? (
                <div className="rfq-layout">
                  <article className="panel rfq-intake">
                    <div className="settings-heading">
                      <FileText />
                      <div>
                        <h2>Receive an RFQ</h2>
                        <p>
                          Store the original document and create accountable
                          response deadlines.
                        </p>
                      </div>
                    </div>
                    <form className="lead-form" onSubmit={submitRfq}>
                      <input type="hidden" name="action" value="create" />
                      <div className="field-grid">
                        <div className="field-block">
                          <label htmlFor="rfq-title">RFQ title</label>
                          <Input
                            id="rfq-title"
                            name="title"
                            required
                            placeholder="Machine monitoring rollout"
                          />
                        </div>
                        <div className="field-block">
                          <label htmlFor="rfq-reference">
                            Customer reference
                          </label>
                          <Input
                            id="rfq-reference"
                            name="reference"
                            placeholder="RFQ/2026/184"
                          />
                        </div>
                      </div>
                      <div className="field-grid">
                        <div className="field-block">
                          <label htmlFor="rfq-company">Requester company</label>
                          <Input
                            id="rfq-company"
                            name="requesterCompany"
                            required
                            placeholder="ABC Pharma"
                          />
                        </div>
                        <div className="field-block">
                          <label htmlFor="rfq-contact">Contact</label>
                          <Input
                            id="rfq-contact"
                            name="contactName"
                            placeholder="Rajesh Mehta"
                          />
                        </div>
                      </div>
                      <div className="field-grid">
                        <div className="field-block">
                          <label htmlFor="rfq-location">
                            Delivery location
                          </label>
                          <Input
                            id="rfq-location"
                            name="deliveryLocation"
                            placeholder="Ahmedabad, Gujarat"
                          />
                        </div>
                        <div className="field-block">
                          <label htmlFor="rfq-deadline">
                            Submission deadline
                          </label>
                          <Input
                            id="rfq-deadline"
                            name="submissionDeadline"
                            type="date"
                          />
                        </div>
                      </div>
                      <div className="field-block">
                        <label htmlFor="rfq-items">Requested items</label>
                        <Textarea
                          id="rfq-items"
                          name="items"
                          placeholder={
                            'One per line: Product | Quantity | Specification\nSensor gateway | 40 | IP65, SAP integration'
                          }
                        />
                        <small className="field-help">
                          Each line becomes a structured RFQ item with its
                          original text retained as evidence.
                        </small>
                      </div>
                      <label className="upload-control rfq-upload">
                        <FileText />
                        Attach original RFQ
                        <input
                          name="document"
                          type="file"
                          accept=".pdf,.docx,.xlsx,.csv,.txt,.png,.jpg,.jpeg"
                        />
                      </label>
                      <Button className="save-button" type="submit">
                        Create RFQ workflow
                      </Button>
                    </form>
                  </article>
                  <section className="rfq-list">
                    <div className="event-list-heading">
                      <div>
                        <h2>RFQ pipeline</h2>
                        <p>Earliest submission deadlines appear first.</p>
                      </div>
                      <b>{rfqs.length} total</b>
                    </div>
                    {rfqs.length ? (
                      rfqs.map((item) => (
                        <article className="panel rfq-record" key={item.id}>
                          <div>
                            <span>
                              <strong>{item.title}</strong>
                              <small>
                                {item.requesterCompany}
                                {item.reference ? ` · ${item.reference}` : ''}
                              </small>
                            </span>
                            <b className="stage-chip">
                              {item.status.replaceAll('_', ' ')}
                            </b>
                          </div>
                          <div className="event-meta">
                            <span>
                              <small>Customer deadline</small>
                              <strong>
                                {item.submissionDeadline || 'Not set'}
                              </strong>
                            </span>
                            <span>
                              <small>Owner SLA</small>
                              <strong>
                                {item.ownerDueAt
                                  ? new Date(item.ownerDueAt).toLocaleString()
                                  : 'Not set'}
                              </strong>
                            </span>
                            <span>
                              <small>Owner</small>
                              <strong>{item.ownerName || item.ownerId}</strong>
                            </span>
                            <span>
                              <small>Submissions</small>
                              <strong>{item.submissionCount || 0}</strong>
                            </span>
                          </div>
                          <p>
                            {item.clarificationNote
                              ? `Clarification: ${item.clarificationNote}`
                              : item.latestSubmissionNote
                                ? `Latest submission: ${item.latestSubmissionNote}`
                                : item.processingStatus ===
                                    'stored_pending_extraction'
                                  ? 'Original stored securely · AI extraction pending configuration'
                                  : 'Manual structured intake'}
                          </p>
                          <select
                            aria-label={`Status for ${item.title}`}
                            value={item.status}
                            onChange={(event) =>
                              updateRfqStatus(item, event.target.value)
                            }
                          >
                            <option value="received">Received</option>
                            <option value="reviewing">Reviewing</option>
                            <option value="clarification">
                              Clarification needed
                            </option>
                            <option value="ready_to_quote">
                              Ready to quote
                            </option>
                            <option value="quoted">Quoted</option>
                            <option value="won">Won</option>
                            <option value="lost">Lost</option>
                          </select>
                          {['ready_to_quote', 'quoted'].includes(
                            item.status,
                          ) ? (
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => recordRfqSubmission(item)}
                            >
                              Record submission
                            </Button>
                          ) : null}
                        </article>
                      ))
                    ) : (
                      <article className="panel empty-state large">
                        <FileText />
                        <h2>No RFQs received</h2>
                        <p>
                          Upload the original request or enter structured
                          requirements manually.
                        </p>
                      </article>
                    )}
                  </section>
                </div>
              ) : null}
              {activeView === 'rfqs' ? (
                <section className="quotation-section">
                  <div className="event-list-heading">
                    <div>
                      <h2>Quotations</h2>
                      <p>
                        Track the commercial document from draft through
                        customer acceptance.
                      </p>
                    </div>
                    <b>{quotations.length} total</b>
                  </div>
                  <div className="quotation-layout">
                    <article className="panel rfq-intake">
                      <form className="lead-form" onSubmit={submitQuotation}>
                        <input type="hidden" name="action" value="create" />
                        <div className="field-grid">
                          <div className="field-block">
                            <label htmlFor="quote-number">
                              Quotation number
                            </label>
                            <Input
                              id="quote-number"
                              name="quoteNumber"
                              required
                              placeholder="Q-2026-001"
                            />
                          </div>
                          <div className="field-block">
                            <label htmlFor="quote-customer">Customer</label>
                            <Input
                              id="quote-customer"
                              name="customer"
                              required
                              placeholder="ABC Pharma"
                            />
                          </div>
                        </div>
                        <div className="field-grid">
                          <div className="field-block">
                            <label htmlFor="quote-amount">
                              Amount ({appContext?.workspace.currency || 'INR'})
                            </label>
                            <Input
                              id="quote-amount"
                              name="amount"
                              type="number"
                              min="1"
                              required
                            />
                          </div>
                          <div className="field-block">
                            <label htmlFor="quote-valid">Valid until</label>
                            <Input
                              id="quote-valid"
                              name="validUntil"
                              type="date"
                            />
                          </div>
                        </div>
                        <div className="field-grid">
                          <div className="field-block">
                            <label htmlFor="quote-rfq">Related RFQ</label>
                            <select id="quote-rfq" name="rfqId" defaultValue="">
                              <option value="">No RFQ selected</option>
                              {rfqs.map((item) => (
                                <option key={item.id} value={item.id}>
                                  {item.title}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="field-block">
                            <label htmlFor="quote-opportunity">
                              Related opportunity
                            </label>
                            <select
                              id="quote-opportunity"
                              name="opportunityId"
                              defaultValue=""
                            >
                              <option value="">No opportunity selected</option>
                              {opportunities.map((item) => (
                                <option key={item.id} value={item.id}>
                                  {item.title} · {item.company}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <label className="upload-control rfq-upload">
                          <FileText />
                          Attach PDF or DOCX
                          <input
                            name="document"
                            type="file"
                            accept=".pdf,.docx"
                          />
                        </label>
                        <Button type="submit" className="save-button">
                          Create quotation
                        </Button>
                      </form>
                    </article>
                    <div className="quotation-list">
                      {quotations.length ? (
                        quotations.map((item) => (
                          <article className="panel quote-record" key={item.id}>
                            <div>
                              <span>
                                <strong>{item.quoteNumber}</strong>
                                <small>
                                  {item.customer} · v{item.version}
                                </small>
                              </span>
                              <strong>
                                {money(item.amount, item.currency)}
                              </strong>
                            </div>
                            <div>
                              <span>
                                Valid until {item.validUntil || 'not set'}
                              </span>
                              {item.hasDocument ? (
                                <button
                                  type="button"
                                  onClick={() => downloadQuotation(item)}
                                >
                                  Download {item.originalName || 'document'}
                                </button>
                              ) : (
                                <span>No document attached</span>
                              )}
                            </div>
                            <select
                              aria-label={`Status for quotation ${item.quoteNumber}`}
                              value={item.status}
                              onChange={(event) =>
                                updateQuotationStatus(item, event.target.value)
                              }
                            >
                              <option value={item.status}>
                                {item.status.replaceAll('_', ' ')}
                              </option>
                              {item.status === 'draft' ? (
                                <option value="approved">
                                  Approve internally
                                </option>
                              ) : null}
                              {item.status === 'approved' ? (
                                <>
                                  <option value="sent">Mark sent</option>
                                  <option value="expired">Expire</option>
                                </>
                              ) : null}
                              {item.status === 'sent' ? (
                                <>
                                  <option value="accepted">Accepted</option>
                                  <option value="rejected">Rejected</option>
                                  <option value="expired">Expired</option>
                                </>
                              ) : null}
                            </select>
                            {item.status !== 'accepted' ? (
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => reviseQuotation(item)}
                              >
                                Create revision
                              </Button>
                            ) : null}
                          </article>
                        ))
                      ) : (
                        <article className="panel empty-state large">
                          <FileText />
                          <h2>No quotations yet</h2>
                          <p>
                            Create the first commercial response and link it to
                            an RFQ or opportunity.
                          </p>
                        </article>
                      )}
                    </div>
                  </div>
                </section>
              ) : null}
              {activeView === 'rfqs' &&
              rfqs.some((item) => item.documentCount) ? (
                <section className="rfq-extraction-section">
                  <div className="event-list-heading">
                    <div>
                      <h2>Document extraction</h2>
                      <p>
                        Review and correct every machine-read requirement before
                        confirmation.
                      </p>
                    </div>
                  </div>
                  <div className="rfq-extraction-list">
                    {rfqs
                      .filter((item) => item.documentCount)
                      .map((item) => {
                        const extracted = rfqExtraction(item.extractionJson);
                        return (
                          <article
                            className="panel rfq-extraction"
                            key={item.id}
                          >
                            <div>
                              <span>
                                <strong>{item.title}</strong>
                                <small>{item.requesterCompany}</small>
                              </span>
                              <b>
                                {item.extractionStatus?.replaceAll('_', ' ') ||
                                  'not processed'}
                              </b>
                            </div>
                            {item.extractionStatus === 'completed' &&
                            extracted ? (
                              <form
                                className="rfq-review-form"
                                onSubmit={(event) =>
                                  confirmRfqExtraction(event, item)
                                }
                              >
                                <p>{extracted.summary}</p>
                                <div className="field-grid">
                                  <div className="field-block">
                                    <label htmlFor={`rfq-location-${item.id}`}>
                                      Delivery location
                                    </label>
                                    <Input
                                      id={`rfq-location-${item.id}`}
                                      name="deliveryLocation"
                                      defaultValue={
                                        extracted.deliveryLocation || ''
                                      }
                                    />
                                  </div>
                                  <div className="field-block">
                                    <label htmlFor={`rfq-deadline-${item.id}`}>
                                      Submission deadline
                                    </label>
                                    <Input
                                      id={`rfq-deadline-${item.id}`}
                                      name="submissionDeadline"
                                      type="date"
                                      defaultValue={
                                        extracted.submissionDeadline || ''
                                      }
                                    />
                                  </div>
                                </div>
                                {extracted.items.map((line, index) => (
                                  <fieldset key={`${line.product}-${index}`}>
                                    <legend>Requirement {index + 1}</legend>
                                    <Input
                                      name="product"
                                      required
                                      defaultValue={line.product}
                                      aria-label={`Product ${index + 1}`}
                                    />
                                    <Input
                                      name="quantity"
                                      defaultValue={line.quantity || ''}
                                      placeholder="Quantity"
                                      aria-label={`Quantity ${index + 1}`}
                                    />
                                    <Textarea
                                      name="specifications"
                                      defaultValue={line.specifications || ''}
                                      placeholder="Specifications"
                                      aria-label={`Specifications ${index + 1}`}
                                    />
                                    <small>Evidence: {line.evidence}</small>
                                  </fieldset>
                                ))}
                                {extracted.warnings.length ? (
                                  <small>
                                    {extracted.warnings.join(' · ')}
                                  </small>
                                ) : null}
                                <Button
                                  type="submit"
                                  disabled={processingRfq === item.id}
                                >
                                  {processingRfq === item.id
                                    ? 'Confirming…'
                                    : 'Confirm reviewed requirements'}
                                </Button>
                              </form>
                            ) : item.extractionStatus === 'confirmed' ? (
                              <p>
                                Human-reviewed requirements are now part of the
                                RFQ workflow.
                              </p>
                            ) : (
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => analyzeRfq(item.id)}
                                disabled={processingRfq === item.id}
                              >
                                {processingRfq === item.id
                                  ? 'Extracting…'
                                  : 'Extract requirements'}
                              </Button>
                            )}
                          </article>
                        );
                      })}
                  </div>
                </section>
              ) : null}
              {activeView === 'meetings' ? (
                <div className="meetings-layout">
                  <article className="panel meeting-intake">
                    <div className="settings-heading">
                      <CalendarDays />
                      <div>
                        <h2>Schedule a meeting</h2>
                        <p>
                          Create an accountable calendar record without sending
                          anything automatically.
                        </p>
                      </div>
                    </div>
                    <form className="lead-form" onSubmit={createMeeting}>
                      <div className="field-block">
                        <label htmlFor="meeting-title">Meeting title</label>
                        <Input
                          id="meeting-title"
                          name="title"
                          required
                          placeholder="Machine monitoring architecture review"
                        />
                      </div>
                      <div className="field-block">
                        <label htmlFor="meeting-lead">Primary contact</label>
                        <select id="meeting-lead" name="leadId" defaultValue="">
                          <option value="">No linked contact</option>
                          {capturedLeads
                            .filter((lead) => lead.reviewStatus !== 'erased')
                            .map((lead) => (
                              <option key={lead.id} value={lead.id}>
                                {lead.fullName} · {lead.company}
                              </option>
                            ))}
                        </select>
                      </div>
                      <div className="field-grid">
                        <div className="field-block">
                          <label htmlFor="meeting-start">Starts</label>
                          <Input
                            id="meeting-start"
                            name="startsAt"
                            type="datetime-local"
                            required
                          />
                        </div>
                        <div className="field-block">
                          <label htmlFor="meeting-end">Ends</label>
                          <Input
                            id="meeting-end"
                            name="endsAt"
                            type="datetime-local"
                            required
                          />
                        </div>
                      </div>
                      <div className="field-block">
                        <label htmlFor="meeting-location">
                          Location or call link
                        </label>
                        <Input
                          id="meeting-location"
                          name="location"
                          placeholder="Google Meet, booth, customer office…"
                        />
                      </div>
                      <div className="field-block">
                        <label htmlFor="meeting-participants">
                          Additional participant emails
                        </label>
                        <Input
                          id="meeting-participants"
                          name="participantEmails"
                          placeholder="it@customer.com, operations@customer.com"
                        />
                        <small className="field-help">
                          The primary contact is included automatically when an
                          email is available. No invitation is sent.
                        </small>
                      </div>
                      <div className="field-block">
                        <label htmlFor="meeting-agenda">Agenda</label>
                        <Textarea
                          id="meeting-agenda"
                          name="agenda"
                          placeholder="Topics, required documents and intended decision"
                        />
                      </div>
                      <Button
                        className="save-button"
                        type="submit"
                        disabled={!activeEventId}
                      >
                        Schedule meeting
                      </Button>
                      {!activeEventId ? (
                        <p className="field-help">
                          Select an active event before creating an unlinked
                          meeting.
                        </p>
                      ) : null}
                    </form>
                  </article>
                  <section className="meeting-list">
                    <div className="event-list-heading">
                      <div>
                        <h2>Meeting schedule</h2>
                        <p>
                          Calendar files are generated on demand; the system
                          does not claim an invitation was delivered.
                        </p>
                      </div>
                      <b>{meetings.length} total</b>
                    </div>
                    {meetings.length ? (
                      meetings.map((meeting) => (
                        <article
                          className="panel meeting-record"
                          key={meeting.id}
                        >
                          <div>
                            <span>
                              <strong>{meeting.title}</strong>
                              <small>
                                {meeting.leadName
                                  ? `${meeting.leadName}${meeting.company ? ` · ${meeting.company}` : ''}`
                                  : 'No primary contact'}{' '}
                                · {meeting.participantCount} participant
                                {meeting.participantCount === 1 ? '' : 's'}
                              </small>
                            </span>
                            <b className={`event-status ${meeting.status}`}>
                              {meeting.status}
                            </b>
                          </div>
                          <div className="event-meta">
                            <span>
                              <small>Starts</small>
                              <strong>
                                {new Date(meeting.startsAt).toLocaleString()}
                              </strong>
                            </span>
                            <span>
                              <small>Ends</small>
                              <strong>
                                {new Date(meeting.endsAt).toLocaleString()}
                              </strong>
                            </span>
                          </div>
                          {meeting.location ? <p>{meeting.location}</p> : null}
                          {meeting.cancellationReason ? (
                            <p className="form-error">
                              Cancelled: {meeting.cancellationReason}
                            </p>
                          ) : null}
                          <div className="event-actions">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => downloadMeeting(meeting)}
                            >
                              Download .ics
                            </Button>
                            {meeting.status === 'scheduled' ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() =>
                                    transitionMeeting(meeting, 'complete')
                                  }
                                >
                                  Mark complete
                                </button>
                                <button
                                  className="danger-link"
                                  type="button"
                                  onClick={() =>
                                    transitionMeeting(meeting, 'cancel')
                                  }
                                >
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={() =>
                                  transitionMeeting(meeting, 'reopen')
                                }
                              >
                                Reopen
                              </button>
                            )}
                          </div>
                        </article>
                      ))
                    ) : (
                      <article className="panel empty-state large">
                        <CalendarDays />
                        <h2>No meetings scheduled</h2>
                        <p>
                          Create a meeting linked to an event and optionally a
                          customer contact.
                        </p>
                      </article>
                    )}
                  </section>
                </div>
              ) : null}
              {activeView === 'events' ? (
                <div className="events-layout">
                  <article className="panel event-builder">
                    <div className="settings-heading">
                      <CalendarDays />
                      <div>
                        <h2>Prepare an event</h2>
                        <p>
                          Configure the booth goal, qualification playbook,
                          routing and follow-up standard before the team
                          arrives.
                        </p>
                      </div>
                    </div>
                    <form
                      className="lead-form"
                      key={appContext?.workspace.id || 'event-loading'}
                      onSubmit={submitEvent}
                    >
                      <div className="field-grid">
                        <div className="field-block">
                          <label htmlFor="event-name">Event name</label>
                          <Input
                            id="event-name"
                            name="name"
                            required
                            placeholder="IndustrialTech Expo 2027"
                          />
                        </div>
                        <div className="field-block">
                          <label htmlFor="event-venue">Venue</label>
                          <Input
                            id="event-venue"
                            name="venue"
                            placeholder="Bombay Exhibition Centre"
                          />
                        </div>
                      </div>
                      <div className="event-three">
                        <div className="field-block">
                          <label htmlFor="event-hall">Hall</label>
                          <Input id="event-hall" name="hall" placeholder="2" />
                        </div>
                        <div className="field-block">
                          <label htmlFor="event-booth">Booth</label>
                          <Input
                            id="event-booth"
                            name="booth"
                            placeholder="B-18"
                          />
                        </div>
                        <div className="field-block">
                          <label htmlFor="event-zone">Timezone</label>
                          <Input
                            id="event-zone"
                            name="timezone"
                            defaultValue={
                              appContext?.workspace.timezone || 'Asia/Kolkata'
                            }
                            required
                          />
                        </div>
                      </div>
                      <div className="field-grid">
                        <div className="field-block">
                          <label htmlFor="event-start">Starts</label>
                          <Input
                            id="event-start"
                            name="startsOn"
                            type="date"
                            required
                          />
                        </div>
                        <div className="field-block">
                          <label htmlFor="event-end">Ends</label>
                          <Input
                            id="event-end"
                            name="endsOn"
                            type="date"
                            required
                          />
                        </div>
                      </div>
                      <div className="field-block">
                        <label htmlFor="event-objective-detail">
                          Business objective
                        </label>
                        <Textarea
                          id="event-objective-detail"
                          name="objective"
                          placeholder="Book 30 qualified demos and create a measurable sales pipeline."
                        />
                      </div>
                      <div className="field-grid">
                        <div className="field-block">
                          <label htmlFor="event-products">
                            Products or services
                          </label>
                          <Input
                            id="event-products"
                            name="products"
                            placeholder="MachineSight, Integration assessment"
                          />
                        </div>
                        <div className="field-block">
                          <label htmlFor="event-targets">Target accounts</label>
                          <Input
                            id="event-targets"
                            name="targetAccounts"
                            placeholder="ABC Pharma, Prime Polymers"
                          />
                        </div>
                      </div>
                      <div className="field-block">
                        <label htmlFor="event-questions">
                          Qualification questions
                        </label>
                        <Textarea
                          id="event-questions"
                          name="qualificationQuestions"
                          placeholder="How many machines?, Which ERP?, When does budget open? (comma separated)"
                        />
                      </div>
                      <div className="field-grid">
                        <div className="field-block">
                          <label htmlFor="event-budget">
                            Event budget (
                            {appContext?.workspace.currency || 'INR'})
                          </label>
                          <Input
                            id="event-budget"
                            name="budget"
                            type="number"
                            min="0"
                            defaultValue="0"
                          />
                        </div>
                        <div className="field-block">
                          <label htmlFor="event-attribution-window">
                            Attribution window (days)
                          </label>
                          <Input
                            id="event-attribution-window"
                            name="attributionWindowDays"
                            type="number"
                            min="0"
                            max="730"
                            defaultValue="180"
                          />
                        </div>
                        <div className="field-block">
                          <label htmlFor="event-margin">
                            Expected gross margin (%)
                          </label>
                          <Input
                            id="event-margin"
                            name="grossMarginPercent"
                            type="number"
                            min="0"
                            max="100"
                            step="0.1"
                            defaultValue="40"
                          />
                        </div>
                        <div className="field-block">
                          <label htmlFor="event-badge">
                            Badge or QR provider
                          </label>
                          <Input
                            id="event-badge"
                            name="badgeProvider"
                            placeholder="Manual / provider name"
                          />
                        </div>
                      </div>
                      <div className="event-three">
                        <div className="field-block">
                          <label htmlFor="event-route">Lead owner</label>
                          <select
                            id="event-route"
                            name="leadRoutingRule"
                            defaultValue="capturer"
                          >
                            <option value="capturer">
                              Person who captures
                            </option>
                            <option value="round_robin">Round robin</option>
                            <option value="manager_review">
                              Manager assigns
                            </option>
                          </select>
                        </div>
                        <div className="field-block">
                          <label htmlFor="event-sla">
                            Follow-up SLA (hours)
                          </label>
                          <Input
                            id="event-sla"
                            name="followupSlaHours"
                            type="number"
                            min="1"
                            max="720"
                            defaultValue="24"
                          />
                        </div>
                        <div className="field-block">
                          <label htmlFor="event-target">
                            Daily lead target
                          </label>
                          <Input
                            id="event-target"
                            name="dailyLeadTarget"
                            type="number"
                            min="1"
                            defaultValue="25"
                          />
                        </div>
                      </div>
                      <div className="field-block">
                        <label htmlFor="event-team">
                          Assigned team members
                        </label>
                        <select
                          id="event-team"
                          name="teamMemberIds"
                          multiple
                          size={Math.min(4, Math.max(2, members.length))}
                        >
                          {members
                            .filter((member) => member.status === 'active')
                            .map((member) => (
                              <option key={member.id} value={member.userId}>
                                {member.displayName ||
                                  member.email ||
                                  'Team member'}{' '}
                                · {member.role}
                              </option>
                            ))}
                        </select>
                        <small className="field-help">
                          Hold Ctrl or Command to select more than one person.
                          The creator is assigned automatically; owners and
                          admins retain workspace oversight.
                        </small>
                      </div>
                      <Button
                        className="save-button"
                        type="submit"
                        disabled={
                          !['owner', 'admin', 'manager'].includes(
                            appContext?.role || '',
                          )
                        }
                      >
                        Create event workspace
                      </Button>
                    </form>
                  </article>
                  <section
                    className="event-list"
                    aria-label="Configured events"
                  >
                    <div className="event-list-heading">
                      <div>
                        <h2>Configured events</h2>
                        <p>Select the event used for new lead captures.</p>
                      </div>
                      <b>
                        {
                          events.filter((item) => item.status === 'active')
                            .length
                        }{' '}
                        activated
                      </b>
                    </div>
                    {events.length ? (
                      events.map((item) => (
                        <article
                          className={`panel event-record ${item.id === activeEventId ? 'selected' : ''} ${item.status === 'archived' ? 'archived' : ''}`}
                          key={item.id}
                        >
                          <div className="event-record-head">
                            <span className="calendar-tile">
                              <b>
                                {new Date(
                                  `${item.startsOn}T00:00:00`,
                                ).toLocaleDateString('en', { day: '2-digit' })}
                              </b>
                              <small>
                                {new Date(
                                  `${item.startsOn}T00:00:00`,
                                ).toLocaleDateString('en', { month: 'short' })}
                              </small>
                            </span>
                            <span>
                              <strong>{item.name}</strong>
                              <small>
                                {item.venue || 'Venue pending'}
                                {item.hall ? ` · Hall ${item.hall}` : ''}
                                {item.booth ? ` · Booth ${item.booth}` : ''}
                              </small>
                            </span>
                            <b className={`event-status ${item.status}`}>
                              {item.status}
                            </b>
                          </div>
                          <p>
                            {item.objective ||
                              'Business objective not added yet.'}
                          </p>
                          <div className="event-meta">
                            <span>
                              <small>Dates</small>
                              <strong>
                                {item.startsOn} → {item.endsOn}
                              </strong>
                            </span>
                            <span>
                              <small>Budget</small>
                              <strong>
                                {appContext?.workspace.currency || 'INR'}{' '}
                                {item.budget.toLocaleString()}
                              </strong>
                            </span>
                            <span>
                              <small>Follow-up</small>
                              <strong>{item.followupSlaHours}h SLA</strong>
                            </span>
                            <span>
                              <small>QR campaign</small>
                              <strong>
                                {item.qrCampaignCode || 'Pending'}
                              </strong>
                            </span>
                          </div>
                          {item.products.length ? (
                            <div className="event-tags">
                              {item.products.map((product) => (
                                <span key={product}>{product}</span>
                              ))}
                            </div>
                          ) : null}
                          {item.readinessChecks.length ? (
                            <div className="readiness-checks">
                              {item.readinessChecks.map((check) => (
                                <span
                                  className={
                                    check.passed ? 'passed' : 'blocked'
                                  }
                                  key={check.key}
                                  title={check.detail}
                                >
                                  {check.passed ? <Check /> : <AlertTriangle />}
                                  {check.label}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <small className="readiness-empty">
                              Readiness has not been assessed for configuration
                              v{item.configVersion}.
                            </small>
                          )}
                          <div className="event-actions">
                            {item.status === 'active' ? (
                              <Button
                                type="button"
                                variant={
                                  item.id === activeEventId
                                    ? 'default'
                                    : 'outline'
                                }
                                onClick={() => selectEvent(item.id)}
                              >
                                {item.id === activeEventId ? (
                                  <>
                                    <Check /> Active event
                                  </>
                                ) : (
                                  'Use for capture'
                                )}
                              </Button>
                            ) : item.status === 'ready' ? (
                              <Button
                                type="button"
                                onClick={() => eventAction('activate', item.id)}
                              >
                                Activate for capture
                              </Button>
                            ) : item.status === 'draft' ? (
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() =>
                                  eventAction('assess_readiness', item.id)
                                }
                              >
                                Run readiness
                              </Button>
                            ) : null}
                            {item.status === 'active' ? (
                              <button
                                type="button"
                                onClick={() =>
                                  eventAction('assess_readiness', item.id)
                                }
                              >
                                Recheck
                              </button>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => eventAction('duplicate', item.id)}
                            >
                              Duplicate
                            </button>
                            {item.status !== 'archived' ? (
                              <button
                                className="danger-link"
                                type="button"
                                onClick={() => eventAction('archive', item.id)}
                              >
                                Archive
                              </button>
                            ) : null}
                          </div>
                        </article>
                      ))
                    ) : (
                      <article className="panel empty-state large">
                        <CalendarDays />
                        <h2>No event configured</h2>
                        <p>
                          Create the first event playbook. It stays in draft
                          until selected for capture.
                        </p>
                      </article>
                    )}
                  </section>
                </div>
              ) : null}
              {activeView === 'roi' ? (
                <div className="events-layout">
                  <section className="roi-grid">
                    <article className="panel roi-card">
                      <small>Reconciled investment</small>
                      <strong>
                        {money(
                          revenueReport?.investmentBasis || 0,
                          appContext?.workspace.currency,
                        )}
                      </strong>
                      <span>
                        {revenueReport?.investmentBasisSource ===
                        'actual_cost_lines'
                          ? 'Actual cost lines'
                          : revenueReport?.investmentBasisSource ===
                              'planned_cost_lines'
                            ? 'Planned cost lines'
                            : 'Planned event budget'}{' '}
                        · actual{' '}
                        {money(
                          revenueReport?.actualInvestment || 0,
                          appContext?.workspace.currency,
                        )}
                      </span>
                    </article>
                    <article className="panel roi-card">
                      <small>Open pipeline</small>
                      <strong>
                        {money(
                          revenueReport?.pipelineValue || 0,
                          appContext?.workspace.currency,
                        )}
                      </strong>
                      <span>
                        Weighted:{' '}
                        {money(
                          revenueReport?.weightedPipelineValue || 0,
                          appContext?.workspace.currency,
                        )}
                      </span>
                    </article>
                    <article className="panel roi-card">
                      <small>Closed revenue</small>
                      <strong>
                        {money(
                          revenueReport?.closedRevenue || 0,
                          appContext?.workspace.currency,
                        )}
                      </strong>
                      <span>
                        {revenueReport?.wonOpportunities || 0} attributed won
                        opportunities
                      </span>
                    </article>
                    <article className="panel roi-card">
                      <small>Revenue ROI</small>
                      <strong>
                        {revenueReport?.revenueRoiPercent == null
                          ? 'Not available'
                          : `${revenueReport.revenueRoiPercent.toFixed(1)}%`}
                      </strong>
                      <span>
                        Revenue less investment, divided by investment
                      </span>
                    </article>
                    <article className="panel roi-card">
                      <small>Estimated gross profit</small>
                      <strong>
                        {money(
                          revenueReport?.grossProfit || 0,
                          appContext?.workspace.currency,
                        )}
                      </strong>
                      <span>
                        Uses each event&apos;s configured gross margin
                      </span>
                    </article>
                    <article className="panel roi-card">
                      <small>Profit ROI</small>
                      <strong>
                        {revenueReport?.profitRoiPercent == null
                          ? 'Not available'
                          : `${revenueReport.profitRoiPercent.toFixed(1)}%`}
                      </strong>
                      <span>
                        Gross profit less investment, divided by investment
                      </span>
                    </article>
                  </section>
                  <section className="settings-grid">
                    <article className="panel settings-card">
                      <h2>Cost reconciliation</h2>
                      <p>
                        Add actual invoices separately from planned costs. Voids
                        preserve an immutable reason and version history.
                      </p>
                      <form className="lead-form" onSubmit={submitEventCost}>
                        <div className="field-grid">
                          <div className="field-block">
                            <label htmlFor="cost-status">Cost status</label>
                            <select
                              id="cost-status"
                              name="status"
                              defaultValue="actual"
                            >
                              <option value="actual">Actual cost</option>
                              <option value="planned">Planned cost</option>
                            </select>
                          </div>
                          <div className="field-block">
                            <label htmlFor="cost-category">Category</label>
                            <select
                              id="cost-category"
                              name="category"
                              defaultValue="space"
                            >
                              <option value="space">Space and booth</option>
                              <option value="travel">Travel</option>
                              <option value="logistics">Logistics</option>
                              <option value="marketing">Marketing</option>
                              <option value="staffing">Staffing</option>
                              <option value="technology">Technology</option>
                              <option value="other">Other</option>
                            </select>
                          </div>
                          <div className="field-block">
                            <label htmlFor="cost-description">
                              Description
                            </label>
                            <Input
                              id="cost-description"
                              name="description"
                              placeholder="Booth invoice"
                              required
                            />
                          </div>
                          <div className="field-block">
                            <label htmlFor="cost-vendor">Vendor</label>
                            <Input
                              id="cost-vendor"
                              name="vendor"
                              placeholder="Vendor"
                            />
                          </div>
                          <div className="field-block">
                            <label htmlFor="cost-amount">
                              Amount ({appContext?.workspace.currency || 'INR'})
                            </label>
                            <Input
                              id="cost-amount"
                              name="amount"
                              type="number"
                              min="0"
                              step="1"
                              placeholder="Amount"
                              required
                            />
                          </div>
                          <div className="field-block">
                            <label htmlFor="cost-date">Incurred on</label>
                            <Input
                              id="cost-date"
                              name="incurredOn"
                              type="date"
                            />
                          </div>
                        </div>
                        <Button type="submit" disabled={!activeEventId}>
                          Add cost line
                        </Button>
                      </form>
                      <div className="action-list">
                        {eventCosts.map((cost) => (
                          <article className="action-row" key={cost.id}>
                            <span className="action-copy">
                              <strong>{cost.description}</strong>
                              <small>
                                {cost.category} · {cost.status}
                                {cost.vendor ? ` · ${cost.vendor}` : ''}
                              </small>
                            </span>
                            <strong>
                              {money(
                                cost.amount,
                                appContext?.workspace.currency,
                              )}
                            </strong>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => voidEventCost(cost)}
                            >
                              Void
                            </Button>
                          </article>
                        ))}
                      </div>
                    </article>
                    <article className="panel settings-card">
                      <h2>Attribution and reconciliation</h2>
                      <p>
                        Model: 100% to the originating event. Window:{' '}
                        {revenueReport?.attributionWindowDays ??
                          'per-event configuration'}{' '}
                        days after the event.
                      </p>
                      <ul>
                        <li>
                          Accepted quotation value:{' '}
                          {money(
                            revenueReport?.reconciliation
                              .acceptedQuotationValue || 0,
                            appContext?.workspace.currency,
                          )}
                        </li>
                        <li>
                          Won without accepted quotation:{' '}
                          {revenueReport?.reconciliation
                            .wonWithoutAcceptedQuotation || 0}
                        </li>
                        <li>
                          Accepted quotation without won opportunity:{' '}
                          {revenueReport?.reconciliation
                            .acceptedQuotationWithoutWonOpportunity || 0}
                        </li>
                        <li>
                          Outside attribution window:{' '}
                          {revenueReport?.reconciliation
                            .excludedOutsideAttributionWindow || 0}
                        </li>
                      </ul>
                      <div className="task-actions">
                        {[
                          'summary',
                          'leads',
                          'opportunities',
                          'costs',
                          'actions',
                        ].map((kind) => (
                          <Button
                            type="button"
                            variant="outline"
                            key={kind}
                            onClick={() => exportReport(kind)}
                          >
                            Export {kind} CSV
                          </Button>
                        ))}
                      </div>
                    </article>
                  </section>
                </div>
              ) : null}
              {activeView === 'knowledge' ? (
                <div className="knowledge-layout">
                  <article className="panel onboarding-progress">
                    <div>
                      <span>
                        {
                          [
                            knowledge.profile,
                            knowledge.products.length,
                            knowledge.icps.length,
                            knowledge.sources.length,
                          ].filter(Boolean).length
                        }
                        <small>/4</small>
                      </span>
                      <div>
                        <h2>Company intelligence setup</h2>
                        <p>
                          {knowledge.profile
                            ? 'Profile saved. Add products, target customers and evidence.'
                            : 'Start by explaining what the company sells and whom it serves.'}
                        </p>
                      </div>
                    </div>
                    <div className="progress-track">
                      <i
                        style={{
                          width: `${[knowledge.profile, knowledge.products.length, knowledge.icps.length, knowledge.sources.length].filter(Boolean).length * 25}%`,
                        }}
                      />
                    </div>
                  </article>
                  <article className="panel knowledge-card">
                    <h2>Business profile</h2>
                    <form
                      className="lead-form"
                      key={`${appContext?.workspace.id || 'loading'}:${knowledge.profile?.legalName || 'new'}`}
                      onSubmit={submitKnowledge}
                    >
                      <input type="hidden" name="action" value="save_profile" />
                      <div className="field-grid">
                        <div className="field-block">
                          <label htmlFor="company-legal-name">
                            Company name
                          </label>
                          <Input
                            id="company-legal-name"
                            name="legalName"
                            defaultValue={
                              knowledge.profile?.legalName ||
                              appContext?.workspace.name
                            }
                            required
                          />
                        </div>
                        <div className="field-block">
                          <label htmlFor="company-website">Website</label>
                          <Input
                            id="company-website"
                            name="websiteUrl"
                            type="url"
                            defaultValue={knowledge.profile?.websiteUrl}
                            placeholder="https://company.com"
                          />
                        </div>
                      </div>
                      <div className="field-block">
                        <label htmlFor="company-description">
                          What do you sell?
                        </label>
                        <Textarea
                          id="company-description"
                          name="description"
                          defaultValue={knowledge.profile?.description}
                          placeholder="Describe the products, services and customer outcomes."
                        />
                      </div>
                      <div className="field-grid">
                        <div className="field-block">
                          <label htmlFor="target-industries">
                            Target industries
                          </label>
                          <Input
                            id="target-industries"
                            name="targetIndustries"
                            defaultValue={knowledge.profile?.targetIndustries.join(
                              ', ',
                            )}
                            placeholder="Pharma, Automotive, Food processing"
                          />
                        </div>
                        <div className="field-block">
                          <label htmlFor="target-regions">
                            Target geographies
                          </label>
                          <Input
                            id="target-regions"
                            name="targetGeographies"
                            defaultValue={knowledge.profile?.targetGeographies.join(
                              ', ',
                            )}
                            placeholder="India, GCC, Southeast Asia"
                          />
                        </div>
                      </div>
                      <div className="field-block">
                        <label htmlFor="event-objective">
                          Primary event objective
                        </label>
                        <Input
                          id="event-objective"
                          name="eventObjective"
                          defaultValue={knowledge.profile?.eventObjective}
                          placeholder="Book qualified demos with plant operators"
                        />
                      </div>
                      <div className="field-block">
                        <label htmlFor="profile-change-reason">
                          Change reason
                        </label>
                        <Input
                          id="profile-change-reason"
                          name="changeReason"
                          placeholder="Why this profile changed"
                        />
                      </div>
                      <Button className="save-button" type="submit">
                        Save business profile
                      </Button>
                    </form>
                    {knowledge.profileVersions.length ? (
                      <div className="knowledge-records">
                        {knowledge.profileVersions.slice(0, 3).map((item) => (
                          <div key={item.id}>
                            <span>
                              <strong>Profile version {item.version}</strong>
                              <small>
                                {item.changeReason} ·{' '}
                                {new Date(item.createdAt).toLocaleString()}
                              </small>
                            </span>
                            <b>v{item.version}</b>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </article>
                  <article className="panel knowledge-card">
                    <h2>Approved claims</h2>
                    <p className="field-help">
                      Only approved claims may be supplied to AI-generated
                      follow-ups.
                    </p>
                    <form
                      className="lead-form compact-form"
                      onSubmit={submitKnowledge}
                    >
                      <input type="hidden" name="action" value="add_claim" />
                      <Textarea
                        name="claimText"
                        required
                        placeholder="Specific factual claim salespeople may use"
                      />
                      <select name="sourceId" defaultValue="">
                        <option value="">No linked source</option>
                        {knowledge.sources.map((source) => (
                          <option key={source.id} value={source.id}>
                            {source.name} · {source.status}
                          </option>
                        ))}
                      </select>
                      <Textarea
                        name="evidenceNote"
                        placeholder="Evidence note or verification context"
                      />
                      <Button type="submit">Add claim for review</Button>
                    </form>
                    <div className="knowledge-records">
                      {knowledge.claims.map((claim) => (
                        <div key={claim.id}>
                          <span>
                            <strong>{claim.claimText}</strong>
                            <small>
                              {claim.sourceName ||
                                claim.evidenceNote ||
                                'Evidence not linked'}
                            </small>
                          </span>
                          <b>{claim.status}</b>
                          {claim.status === 'draft' &&
                          ['owner', 'admin'].includes(
                            appContext?.role || '',
                          ) ? (
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() =>
                                reviewKnowledge('approve_claim', claim.id)
                              }
                            >
                              Approve
                            </Button>
                          ) : null}
                          {claim.status !== 'retired' &&
                          ['owner', 'admin'].includes(
                            appContext?.role || '',
                          ) ? (
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() =>
                                reviewKnowledge('retire_claim', claim.id)
                              }
                            >
                              Retire
                            </Button>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </article>
                  <article className="panel knowledge-card">
                    <h2>Products and services</h2>
                    <form
                      className="lead-form compact-form"
                      onSubmit={submitKnowledge}
                    >
                      <input type="hidden" name="action" value="add_product" />
                      <div className="field-grid">
                        <Input
                          name="name"
                          required
                          placeholder="Product or service name"
                        />
                        <select name="kind" defaultValue="product">
                          <option value="product">Product</option>
                          <option value="service">Service</option>
                        </select>
                      </div>
                      <Textarea
                        name="description"
                        placeholder="What it does and the outcome it creates"
                      />
                      <Input
                        name="buyerRoles"
                        placeholder="Buyer roles, comma separated"
                      />
                      <Input
                        name="painPoints"
                        placeholder="Pain points solved, comma separated"
                      />
                      <Button type="submit">Add offering</Button>
                    </form>
                    <div className="knowledge-records">
                      {knowledge.products.map((item) => (
                        <div key={item.id}>
                          <span>
                            <strong>{item.name}</strong>
                            <small>
                              {item.kind} ·{' '}
                              {item.buyerRoles.join(', ') ||
                                'Buyer roles not added'}
                            </small>
                          </span>
                          <b>{item.kind}</b>
                          <button
                            className="record-remove"
                            type="button"
                            aria-label={`Remove ${item.name}`}
                            onClick={() =>
                              removeKnowledge(
                                'archive_product',
                                item.id,
                                item.name,
                              )
                            }
                          >
                            <Trash2 />
                          </button>
                        </div>
                      ))}
                    </div>
                  </article>
                  <article className="panel knowledge-card">
                    <h2>Ideal customer profile</h2>
                    <form
                      className="lead-form compact-form"
                      onSubmit={submitKnowledge}
                    >
                      <input type="hidden" name="action" value="add_icp" />
                      <Input
                        name="name"
                        required
                        placeholder="e.g. Multi-site pharmaceutical plants"
                      />
                      <Input
                        name="industries"
                        placeholder="Industries, comma separated"
                      />
                      <Input
                        name="companySizes"
                        placeholder="Company sizes, e.g. 200–5,000 employees"
                      />
                      <Input name="geographies" placeholder="Target regions" />
                      <Input
                        name="buyerRoles"
                        placeholder="Decision-maker roles"
                      />
                      <Textarea
                        name="mustHaveSignals"
                        placeholder="High-value signals, comma separated"
                      />
                      <Textarea
                        name="disqualifiers"
                        placeholder="Disqualifiers, comma separated"
                      />
                      <Button type="submit">Add ideal customer profile</Button>
                    </form>
                    <div className="knowledge-records">
                      {knowledge.icps.map((item) => (
                        <div key={item.id}>
                          <span>
                            <strong>{item.name}</strong>
                            <small>
                              {item.industries.join(', ') || 'Any industry'} ·{' '}
                              {item.buyerRoles.join(', ') || 'Roles not set'}
                            </small>
                          </span>
                          <b>ICP</b>
                          <button
                            className="record-remove"
                            type="button"
                            aria-label={`Remove ${item.name}`}
                            onClick={() =>
                              removeKnowledge('remove_icp', item.id, item.name)
                            }
                          >
                            <Trash2 />
                          </button>
                        </div>
                      ))}
                    </div>
                  </article>
                  <article className="panel knowledge-card">
                    <h2>Qualification rules</h2>
                    <form
                      className="lead-form compact-form"
                      onSubmit={submitKnowledge}
                    >
                      <input type="hidden" name="action" value="add_rule" />
                      <Input
                        name="label"
                        required
                        placeholder="Rule label, e.g. Budget within 6 months"
                      />
                      <div className="field-grid">
                        <select name="field" defaultValue="budget_timing">
                          <option value="budget_timing">Budget timing</option>
                          <option value="authority">Authority</option>
                          <option value="requirement">Requirement</option>
                          <option value="company_size">Company size</option>
                          <option value="product_interest">
                            Product interest
                          </option>
                          <option value="existing_technology">
                            Existing technology
                          </option>
                          <option value="industry">Industry</option>
                          <option value="location">
                            Location or geography
                          </option>
                          <option value="quantity">Quantity or scale</option>
                          <option value="purchase_timeline">
                            Purchase timeline
                          </option>
                        </select>
                        <Input
                          name="expectedValue"
                          required
                          placeholder="Expected value"
                        />
                      </div>
                      <Input
                        name="weight"
                        type="number"
                        min="-100"
                        max="100"
                        defaultValue="20"
                      />
                      <Button type="submit">Add scoring rule</Button>
                    </form>
                    <div className="knowledge-records">
                      {knowledge.rules.map((item) => (
                        <div key={item.id}>
                          <span>
                            <strong>{item.label}</strong>
                            <small>
                              {item.field.replaceAll('_', ' ')} contains “
                              {item.expectedValue}”
                            </small>
                          </span>
                          <b className={item.weight < 0 ? 'negative' : ''}>
                            {item.weight > 0 ? '+' : ''}
                            {item.weight}
                          </b>
                          <button
                            className="record-remove"
                            type="button"
                            aria-label={`Remove ${item.label}`}
                            onClick={() =>
                              removeKnowledge(
                                'archive_rule',
                                item.id,
                                item.label,
                              )
                            }
                          >
                            <Trash2 />
                          </button>
                        </div>
                      ))}
                    </div>
                  </article>
                  <article className="panel knowledge-card knowledge-sources">
                    <h2>Knowledge sources</h2>
                    <p>
                      Store approved evidence used to ground future AI answers.
                    </p>
                    <div className="source-actions">
                      <label className="upload-control">
                        <FileText />
                        Upload document
                        <input
                          type="file"
                          accept=".pdf,.docx,.xlsx,.csv,.txt,.png,.jpg,.jpeg"
                          onInput={uploadKnowledge}
                        />
                      </label>
                      <form onSubmit={submitKnowledge}>
                        <input type="hidden" name="action" value="add_url" />
                        <Input
                          name="sourceUrl"
                          type="url"
                          required
                          placeholder="https://company.com/products"
                        />
                        <Button type="submit">Add website</Button>
                      </form>
                    </div>
                    <div className="knowledge-records">
                      {knowledge.sources.map((item) => (
                        <div key={item.id}>
                          <span>
                            <strong>{item.name}</strong>
                            <small>
                              {item.sourceType} · {item.status}
                              {item.sizeBytes
                                ? ` · ${Math.ceil(item.sizeBytes / 1024)} KB`
                                : ''}
                            </small>
                            {item.ingestionStatus ? (
                              <small>
                                Ingestion:{' '}
                                {item.ingestionStatus.replaceAll('_', ' ')}
                                {item.extractionMethod
                                  ? ` · ${item.extractionMethod.replaceAll('_', ' ')}`
                                  : ''}
                                {item.contentHash
                                  ? ` · SHA-256 ${item.contentHash.slice(0, 12)}…`
                                  : ''}
                              </small>
                            ) : null}
                            {item.lastError ? (
                              <small className="negative">
                                {item.lastError}
                              </small>
                            ) : null}
                          </span>
                          <b>{item.sourceType}</b>
                          {item.ingestionStatus === 'ready_for_review' &&
                          ['stored', 'pending_review'].includes(item.status) &&
                          ['owner', 'admin'].includes(
                            appContext?.role || '',
                          ) ? (
                            <>
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() =>
                                  reviewKnowledge('approve_source', item.id)
                                }
                              >
                                Approve
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() =>
                                  reviewKnowledge('reject_source', item.id)
                                }
                              >
                                Reject
                              </Button>
                            </>
                          ) : null}
                          {item.ingestionStatus === 'failed' &&
                          ['owner', 'admin'].includes(
                            appContext?.role || '',
                          ) ? (
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() =>
                                reviewKnowledge('retry_source', item.id)
                              }
                            >
                              Retry
                            </Button>
                          ) : null}
                          <button
                            className="record-remove"
                            type="button"
                            aria-label={`Remove ${item.name}`}
                            onClick={() =>
                              removeKnowledge(
                                'remove_source',
                                item.id,
                                item.name,
                              )
                            }
                          >
                            <Trash2 />
                          </button>
                        </div>
                      ))}
                    </div>
                  </article>
                </div>
              ) : null}
              {activeView === 'settings' ? (
                <div className="settings-layout">
                  {leadMerges.length ? (
                    <article className="panel settings-card">
                      <div className="settings-heading">
                        <Users />
                        <div>
                          <h2>Reversible contact merges</h2>
                          <p>
                            Undo a merge if two visitors were combined
                            incorrectly.
                          </p>
                        </div>
                      </div>
                      <div className="knowledge-records">
                        {leadMerges.map((merge) => (
                          <div key={merge.id}>
                            <span>
                              <strong>
                                {merge.sourceName} → {merge.targetName}
                              </strong>
                              <small>
                                {new Date(merge.mergedAt).toLocaleString()}
                              </small>
                            </span>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => revertLeadMerge(merge.id)}
                            >
                              Undo merge
                            </Button>
                          </div>
                        ))}
                      </div>
                    </article>
                  ) : null}
                  <article className="panel settings-card workspace-manager">
                    <div className="settings-heading">
                      <Building2 />
                      <div>
                        <h2>Your workspaces</h2>
                        <p>
                          Switch tenant context or create another trial
                          workspace.
                        </p>
                      </div>
                    </div>
                    <div className="workspace-list">
                      {availableWorkspaces.map((workspace) => (
                        <button
                          key={workspace.id}
                          className={
                            workspace.id === appContext?.workspace.id
                              ? 'selected'
                              : ''
                          }
                          onClick={() => switchWorkspace(workspace.id)}
                        >
                          <span>
                            <strong>{workspace.name}</strong>
                            <small>
                              {workspace.role} · {workspace.plan}
                            </small>
                          </span>
                          {workspace.id === appContext?.workspace.id ? (
                            <Check />
                          ) : (
                            <ArrowRight />
                          )}
                        </button>
                      ))}
                    </div>
                    <form className="invite-form" onSubmit={createWorkspace}>
                      <Input
                        name="name"
                        placeholder="New company workspace"
                        required
                      />
                      <Input
                        name="timezone"
                        value={appContext?.workspace.timezone || 'Asia/Kolkata'}
                        readOnly
                      />
                      <Button type="submit">Create</Button>
                    </form>
                  </article>
                  <article className="panel settings-card">
                    <div className="settings-heading">
                      <ShieldCheck />
                      <div>
                        <h2>Workspace identity</h2>
                        <p>
                          Tenant-specific defaults used by dates, reports and
                          revenue.
                        </p>
                      </div>
                    </div>
                    <form
                      className="lead-form"
                      key={appContext?.workspace.id || 'settings-loading'}
                      onSubmit={saveSettings}
                    >
                      <div className="field-block">
                        <label htmlFor="workspace-name">Workspace name</label>
                        <Input
                          id="workspace-name"
                          name="name"
                          key={appContext?.workspace.id}
                          defaultValue={appContext?.workspace.name}
                          required
                        />
                      </div>
                      <div className="field-grid">
                        <div className="field-block">
                          <label htmlFor="workspace-timezone">Timezone</label>
                          <Input
                            id="workspace-timezone"
                            name="timezone"
                            defaultValue={appContext?.workspace.timezone}
                            required
                          />
                        </div>
                        <div className="field-block">
                          <label htmlFor="workspace-currency">Currency</label>
                          <Input
                            id="workspace-currency"
                            name="currency"
                            defaultValue={appContext?.workspace.currency}
                            maxLength={3}
                            required
                          />
                        </div>
                      </div>
                      <div className="settings-actions">
                        <Button
                          className="save-button"
                          type="submit"
                          disabled={
                            !['owner', 'admin'].includes(appContext?.role || '')
                          }
                        >
                          Save workspace
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={exportWorkspace}
                        >
                          Export data
                        </Button>
                      </div>
                    </form>
                  </article>
                  <article className="panel settings-card">
                    <div className="settings-heading">
                      <BarChart3 />
                      <div>
                        <h2>Plan & usage</h2>
                        <p>
                          Transparent workspace usage for subscription planning.
                        </p>
                      </div>
                    </div>
                    <div className="usage-grid">
                      <span>
                        <small>Plan</small>
                        <strong>{appContext?.workspace.plan || 'trial'}</strong>
                      </span>
                      <span>
                        <small>Contacts</small>
                        <strong>{workspaceUsage.leads}</strong>
                      </span>
                      <span>
                        <small>Active events</small>
                        <strong>{workspaceUsage.activeEvents}</strong>
                      </span>
                      <span>
                        <small>Members</small>
                        <strong>
                          {workspaceUsage.activeMembers} /{' '}
                          {planEntitlements.activeMembers}
                        </strong>
                      </span>
                      <span>
                        <small>Knowledge</small>
                        <strong>{workspaceUsage.knowledgeSources}</strong>
                      </span>
                      <span>
                        <small>Stored files</small>
                        <strong>
                          {workspaceUsage.storageBytes < 1048576
                            ? `${Math.ceil(workspaceUsage.storageBytes / 1024)} KB`
                            : `${(workspaceUsage.storageBytes / 1048576).toFixed(1)} MB`}{' '}
                          /{' '}
                          {planEntitlements.storageBytes >= 1073741824
                            ? `${(planEntitlements.storageBytes / 1073741824).toFixed(0)} GB`
                            : `${(planEntitlements.storageBytes / 1048576).toFixed(0)} MB`}
                        </strong>
                      </span>
                      <span>
                        <small>AI rate</small>
                        <strong>
                          {planEntitlements.aiRequestsPerMinute} / minute
                        </strong>
                      </span>
                    </div>
                    <p className="field-help">
                      Billing checkout is intentionally not activated until a
                      payment provider, pricing, taxes, and legal terms are
                      approved.
                    </p>
                  </article>
                  <article
                    className={`panel settings-card capability-card ${capabilities.aiConfigured ? 'ready' : 'attention'}`}
                  >
                    <div className="settings-heading">
                      <Sparkles />
                      <div>
                        <h2>AI capability</h2>
                        <p>
                          {capabilities.aiConfigured
                            ? 'OCR, transcription, conversation analysis, RFQ extraction and follow-up drafting are configured.'
                            : 'Manual workflows are ready. AI workflows need a production API key before client testing.'}
                        </p>
                      </div>
                    </div>
                    <span className="capability-state">
                      <i />
                      {capabilities.aiConfigured
                        ? 'Configured'
                        : 'Configuration required'}
                    </span>
                  </article>
                  {operations ? (
                    <article className="panel settings-card">
                      <div className="settings-heading">
                        <Activity />
                        <div>
                          <h2>Operations health</h2>
                          <p>
                            Durable reminders, retries, dead letters and
                            operator alerts for this workspace.
                          </p>
                        </div>
                      </div>
                      <div className="usage-grid">
                        <span>
                          <small>Status</small>
                          <strong>{operations.health.status}</strong>
                        </span>
                        {['queued', 'failed', 'dead', 'completed'].map(
                          (status) => (
                            <span key={status}>
                              <small>{status}</small>
                              <strong>
                                {operations.health.jobsByStatus[status] || 0}
                              </strong>
                            </span>
                          ),
                        )}
                      </div>
                      <div className="settings-actions">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => operationsAction('run_workspace_jobs')}
                        >
                          Run due jobs now
                        </Button>
                      </div>
                      {operations.alerts.map((alert) => (
                        <div className="audit-row" key={alert.id}>
                          <span>
                            {alert.severity} · {alert.message}
                          </span>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() =>
                              operationsAction('acknowledge_alert', alert.id)
                            }
                          >
                            Acknowledge
                          </Button>
                        </div>
                      ))}
                      {operations.jobs
                        .filter((job) =>
                          ['failed', 'dead'].includes(job.status),
                        )
                        .map((job) => (
                          <div className="audit-row" key={job.id}>
                            <span>
                              {job.kind} · {job.status} · attempt {job.attempts}
                              /{job.maxAttempts}
                            </span>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() =>
                                operationsAction('retry_job', job.id)
                              }
                            >
                              Retry
                            </Button>
                          </div>
                        ))}
                    </article>
                  ) : null}
                  {appContext?.role === 'owner' ? (
                    <article className="panel settings-card">
                      <div className="settings-heading">
                        <ShieldCheck />
                        <div>
                          <h2>Support access</h2>
                          <p>
                            Grant a named support identity read-only access for
                            at most 72 hours. Every access session is audited.
                          </p>
                        </div>
                      </div>
                      <form className="lead-form" onSubmit={grantSupportAccess}>
                        <div className="field-grid">
                          <div className="field-block">
                            <label htmlFor="support-user-id">
                              Authenticated support user ID
                            </label>
                            <Input
                              id="support-user-id"
                              name="supportUserId"
                              required
                              placeholder="User ID supplied by support"
                            />
                          </div>
                          <div className="field-block">
                            <label htmlFor="support-email">Support email</label>
                            <Input
                              id="support-email"
                              name="supportEmail"
                              type="email"
                              required
                              placeholder="agent@support.example"
                            />
                          </div>
                          <div className="field-block">
                            <label htmlFor="support-ticket">
                              Ticket reference
                            </label>
                            <Input
                              id="support-ticket"
                              name="ticketReference"
                              placeholder="SUP-1234"
                            />
                          </div>
                          <div className="field-block">
                            <label htmlFor="support-duration">Duration</label>
                            <select
                              id="support-duration"
                              name="durationHours"
                              defaultValue="8"
                            >
                              <option value="1">1 hour</option>
                              <option value="4">4 hours</option>
                              <option value="8">8 hours</option>
                              <option value="24">24 hours</option>
                              <option value="72">72 hours</option>
                            </select>
                          </div>
                        </div>
                        <div className="field-block">
                          <label htmlFor="support-reason">
                            Exact troubleshooting reason
                          </label>
                          <Textarea
                            id="support-reason"
                            name="reason"
                            required
                            placeholder="Investigate failed RFQ document processing for ticket SUP-1234."
                          />
                        </div>
                        <Button type="submit">Grant support access</Button>
                      </form>
                      <div className="knowledge-records">
                        {supportGrants.map((grant) => (
                          <div key={grant.id}>
                            <span>
                              <strong>{grant.supportEmail}</strong>
                              <small>
                                {grant.status} · expires{' '}
                                {new Date(grant.expiresAt).toLocaleString()}
                                {grant.ticketReference
                                  ? ` · ${grant.ticketReference}`
                                  : ''}
                              </small>
                            </span>
                            {grant.status === 'active' &&
                            grant.expiresAt > clockNow ? (
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => revokeSupportAccess(grant.id)}
                              >
                                Revoke now
                              </Button>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </article>
                  ) : null}
                  <article className="panel settings-card">
                    <div className="settings-heading">
                      <UserPlus />
                      <div>
                        <h2>Invite a teammate</h2>
                        <p>
                          Invitations expire after seven days. This plan allows{' '}
                          {planEntitlements.activeMembers} active members.
                        </p>
                      </div>
                    </div>
                    <form className="invite-form" onSubmit={inviteMember}>
                      <Input
                        name="email"
                        type="email"
                        placeholder="teammate@company.com"
                        required
                      />
                      <select name="role" defaultValue="salesperson">
                        <option value="admin">Administrator</option>
                        <option value="manager">Manager</option>
                        <option value="salesperson">Salesperson</option>
                        <option value="marketing">Marketing</option>
                        <option value="viewer">Viewer</option>
                      </select>
                      <Button
                        type="submit"
                        disabled={
                          !['owner', 'admin'].includes(appContext?.role || '')
                        }
                      >
                        Invite
                      </Button>
                    </form>
                    <div className="member-list">
                      <h3>Members</h3>
                      {members.map((member) => (
                        <div key={member.id}>
                          <span className="profile-avatar">
                            {(member.email || member.displayName || 'TM')
                              .slice(0, 2)
                              .toUpperCase()}
                          </span>
                          <span>
                            <strong>
                              {member.displayName ||
                                member.email ||
                                'Team member'}
                            </strong>
                            <small>{member.email || member.role}</small>
                          </span>
                          {member.role === 'owner' ||
                          !['owner', 'admin'].includes(
                            appContext?.role || '',
                          ) ? (
                            <b>{member.role}</b>
                          ) : (
                            <span className="member-controls">
                              <select
                                aria-label={`Role for ${member.email || member.displayName || 'member'}`}
                                value={member.role}
                                onChange={(event) =>
                                  updateMember(
                                    member.id,
                                    event.target.value,
                                    member.status,
                                  )
                                }
                              >
                                <option value="admin">Admin</option>
                                <option value="manager">Manager</option>
                                <option value="salesperson">Sales</option>
                                <option value="marketing">Marketing</option>
                                <option value="viewer">Viewer</option>
                              </select>
                              <button
                                onClick={() =>
                                  updateMember(
                                    member.id,
                                    member.role,
                                    member.status === 'active'
                                      ? 'inactive'
                                      : 'active',
                                  )
                                }
                                type="button"
                              >
                                {member.status === 'active'
                                  ? 'Deactivate'
                                  : 'Activate'}
                              </button>
                            </span>
                          )}
                        </div>
                      ))}
                      {invitations.map((invite) => (
                        <div key={invite.id} className="pending-member">
                          <span className="profile-avatar">?</span>
                          <span>
                            <strong>{invite.email}</strong>
                            <small>Invitation pending · {invite.role}</small>
                          </span>
                          <button
                            type="button"
                            onClick={() => revokeInvitation(invite.id)}
                          >
                            Revoke
                          </button>
                        </div>
                      ))}
                    </div>
                  </article>
                  {appContext?.role === 'owner' ? (
                    <article className="panel settings-card">
                      <div className="settings-heading">
                        <Trash2 />
                        <div>
                          <h2>Workspace deletion</h2>
                          <p>
                            {deletionRequest
                              ? `Scheduled for ${new Date(deletionRequest.scheduledFor).toLocaleString()}. You can cancel until that time.`
                              : 'Schedule permanent deletion with a seven-day recovery period.'}
                          </p>
                        </div>
                      </div>
                      <form
                        className="lead-form"
                        onSubmit={submitWorkspaceDeletion}
                      >
                        <div className="field-block">
                          <label htmlFor="delete-workspace-name">
                            Type the exact workspace name to confirm
                          </label>
                          <Input
                            id="delete-workspace-name"
                            name="confirmName"
                            required
                            placeholder={appContext.workspace.name}
                          />
                        </div>
                        {deletionRequest ? (
                          <div className="settings-actions">
                            <Button
                              type="submit"
                              name="action"
                              value="execute_deletion"
                              disabled={
                                settingsLoadedAt < deletionRequest.scheduledFor
                              }
                            >
                              Permanently delete workspace
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={cancelWorkspaceDeletion}
                            >
                              Cancel deletion
                            </Button>
                          </div>
                        ) : (
                          <Button
                            type="submit"
                            name="action"
                            value="request_deletion"
                            variant="outline"
                          >
                            Schedule deletion
                          </Button>
                        )}
                      </form>
                    </article>
                  ) : null}
                  <article className="panel settings-card audit-card">
                    <div className="settings-heading">
                      <FileText />
                      <div>
                        <h2>Recent security activity</h2>
                        <p>
                          Important workspace actions are permanently
                          attributed.
                        </p>
                      </div>
                    </div>
                    {auditEvents.length ? (
                      auditEvents.map((item) => (
                        <div className="audit-row" key={item.id}>
                          <span>{item.action.replaceAll('.', ' ')}</span>
                          <small>
                            {item.entityType} ·{' '}
                            {new Date(item.createdAt).toLocaleString()}
                          </small>
                        </div>
                      ))
                    ) : (
                      <div className="empty-state">
                        No recorded workspace changes yet.
                      </div>
                    )}
                  </article>
                </div>
              ) : null}
            </section>
          )}
        </div>
        {notice ? <output className="toast">{notice}</output> : null}
      </section>
      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="search-dialog">
          <DialogHeader>
            <DialogTitle>Search workspace</DialogTitle>
            <DialogDescription>
              Find a contact, account, task, or opportunity.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Type a name, company, or action…"
          />
          <div className="search-results">
            {searchTerm.trim() ? (
              [
                ...capturedLeads.map((lead) => ({
                  label: lead.fullName,
                  meta: lead.company,
                  action: () => {
                    setSearchOpen(false);
                    openReview(lead);
                  },
                })),
                ...tasks.map((task) => ({
                  label: task.title,
                  meta: `${task.fullName} · ${task.company}`,
                  action: () => {
                    setSearchOpen(false);
                    go('today');
                  },
                })),
                ...opportunities.map((item) => ({
                  label: item.title,
                  meta: item.company,
                  action: () => {
                    setSearchOpen(false);
                    go('opportunities');
                  },
                })),
              ]
                .filter((item) =>
                  `${item.label} ${item.meta}`
                    .toLowerCase()
                    .includes(searchTerm.toLowerCase()),
                )
                .slice(0, 8)
                .map((item) => (
                  <button
                    key={`${item.label}-${item.meta}`}
                    onClick={item.action}
                  >
                    <Search />
                    <span>
                      <strong>{item.label}</strong>
                      <small>{item.meta}</small>
                    </span>
                  </button>
                ))
            ) : (
              <div className="empty-state">
                Start typing to search the current workspace.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={opportunityOpen}
        onOpenChange={(open) => {
          setOpportunityOpen(open);
          if (!open) setOpportunityLead(null);
        }}
      >
        <DialogContent className="capture-dialog">
          <DialogHeader>
            <DialogTitle>Create opportunity</DialogTitle>
            <DialogDescription>
              {opportunityLead
                ? `Convert ${opportunityLead.fullName}’s confirmed conversation into pipeline.`
                : 'Add a qualified deal to the active event pipeline.'}
            </DialogDescription>
          </DialogHeader>
          <form className="lead-form" onSubmit={createOpportunity}>
            {opportunityLead ? (
              <input type="hidden" name="leadId" value={opportunityLead.id} />
            ) : null}
            <div className="field-block">
              <label htmlFor="opp-company">Company</label>
              <Input
                id="opp-company"
                name="company"
                required
                placeholder="ABC Pharma"
                defaultValue={
                  opportunityLead?.company === 'Company pending'
                    ? ''
                    : opportunityLead?.company
                }
              />
            </div>
            <div className="field-block">
              <label htmlFor="opp-title">Opportunity</label>
              <Input
                id="opp-title"
                name="title"
                required
                placeholder="Machine monitoring rollout"
              />
            </div>
            <div className="field-grid">
              <div className="field-block">
                <label htmlFor="opp-value">
                  Estimated value ({appContext?.workspace.currency || 'INR'})
                </label>
                <Input
                  id="opp-value"
                  name="value"
                  type="number"
                  min="0"
                  placeholder="1200000"
                />
              </div>
              <div className="field-block">
                <label htmlFor="opp-close">Expected close</label>
                <Input id="opp-close" name="expectedCloseDate" type="date" />
              </div>
            </div>
            <div className="field-block">
              <label htmlFor="opp-contacts">Opportunity stakeholders</label>
              <select
                id="opp-contacts"
                name="contactIds"
                multiple
                defaultValue={opportunityLead ? [opportunityLead.id] : []}
              >
                <option value="" disabled>
                  Select one or more contacts
                </option>
                {capturedLeads
                  .filter(
                    (lead) =>
                      (!activeEventId || lead.eventId === activeEventId) &&
                      (!opportunityLead ||
                        lead.company === opportunityLead.company),
                  )
                  .map((lead) => (
                    <option key={lead.id} value={lead.id}>
                      {lead.fullName} · {lead.company} ·{' '}
                      {lead.buyingRole || lead.role || 'Contact'}
                    </option>
                  ))}
              </select>
              <small className="field-help">
                Use Ctrl or Command to select multiple stakeholders. Contacts
                must belong to the same account and event.
              </small>
            </div>
            <Button className="save-button" type="submit">
              Create opportunity
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
}
