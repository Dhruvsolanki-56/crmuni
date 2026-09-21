'use client';

import { useEffect, useRef, useState, type SyntheticEvent } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Bell,
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
  X,
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
import {
  extractContactCandidates,
  extractEncodedContact,
  mergeContactCandidates,
  type ContactCandidates,
} from '@/lib/client-card-ocr';
import { normalizeCompany } from '@/lib/accounts';

type AskField = {
  name: string;
  label: string;
  type?: 'text' | 'number' | 'date' | 'textarea';
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
};
type AskConfig = {
  title: string;
  description?: string;
  fields?: AskField[];
  confirmLabel?: string;
  destructive?: boolean;
};
type AskRequest = AskConfig & {
  resolve: (values: Record<string, string> | null) => void;
};

type SavedLead = {
  id: string;
  eventId?: string;
  accountId?: string;
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
  customFields?: Record<string, string>;
  relationshipStatus?: string;
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
  | 'settings'
  | 'visitor-home'
  | 'visitor-discover'
  | 'visitor-plan'
  | 'visitor-capture'
  | 'visitor-contacts'
  | 'visitor-memory'
  | 'visitor-followups';
type AppContext = {
  workspace: {
    id: string;
    name: string;
    slug: string;
    timezone: string;
    currency: string;
    plan: string;
    status: string;
    kind: string;
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
    createdAt: number;
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
  leadFieldSchema: string[];
  teamMemberIds: string[];
  leadRoutingRule: string;
  followupSlaHours: number;
  dailyLeadTarget: number;
  badgeProvider?: string;
  qrCampaignCode?: string;
  canonicalEventId?: string;
  directoryVisibility?: string;
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
  handedOffAt?: number;
};
type LeadComment = {
  id: string;
  body: string;
  authorId: string;
  authorName: string;
  mentionedUserIds: string[];
  createdAt: number;
};
type DirectoryEntry = {
  eventId: string;
  eventName: string;
  venue: string | null;
  hall: string | null;
  booth: string | null;
  startsOn: string;
  endsOn: string;
  code: string | null;
  companyName: string;
  companyDescription: string;
  products: string[];
};
type ItineraryItem = {
  id: string;
  title: string;
  kind: string;
  startsAt: number | null;
  notes: string | null;
  status: string;
  visitedAt: number | null;
  createdAt: number;
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

/* Timestamps were rendered with the locale default, which includes seconds —
   precision no one reads, and it clashed with the plain dates beside them. */
function dateTime(value: number | string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Not set';
  return parsed.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const AUDIT_PAGE_SIZE = 8;
const PEOPLE_PAGE_SIZE = 8;

function roiTone(value: number | null | undefined) {
  if (value == null) return 'roi-value';
  return `roi-value ${value < 0 ? 'negative' : 'positive'}`;
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
function eventDates(startsOn: string, endsOn: string) {
  const start = new Date(`${startsOn}T00:00:00`);
  const end = new Date(`${endsOn}T00:00:00`);
  const month = (value: Date) =>
    value.toLocaleDateString('en', { month: 'short' });
  return startsOn.slice(0, 7) === endsOn.slice(0, 7)
    ? `${month(start)} ${start.getDate()}–${end.getDate()}, ${end.getFullYear()}`
    : `${month(start)} ${start.getDate()} → ${month(end)} ${end.getDate()}, ${end.getFullYear()}`;
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

function grayscaleValues(imageData: ImageData) {
  const { data } = imageData;
  const gray = new Uint8ClampedArray(data.length / 4);
  for (let index = 0, pixel = 0; index < data.length; index += 4, pixel += 1) {
    gray[pixel] =
      data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114;
  }
  return gray;
}

// Otsu's method: pick the threshold that best separates ink from
// background across lighting conditions and colored card stock.
function otsuThreshold(gray: Uint8ClampedArray) {
  const histogram = Array.from({ length: 256 }, () => 0);
  for (const value of gray) histogram[value] += 1;
  const total = gray.length;
  let sum = 0;
  for (let level = 0; level < 256; level += 1) sum += level * histogram[level];
  let sumBackground = 0;
  let weightBackground = 0;
  let best = 0;
  let bestVariance = 0;
  for (let level = 0; level < 256; level += 1) {
    weightBackground += histogram[level];
    if (weightBackground === 0) continue;
    const weightForeground = total - weightBackground;
    if (weightForeground === 0) break;
    sumBackground += level * histogram[level];
    const meanBackground = sumBackground / weightBackground;
    const meanForeground = (sum - sumBackground) / weightForeground;
    const variance =
      weightBackground *
      weightForeground *
      (meanBackground - meanForeground) ** 2;
    if (variance > bestVariance) {
      bestVariance = variance;
      best = level;
    }
  }
  return best;
}

function paintGrayscale(
  context: CanvasRenderingContext2D,
  gray: Uint8ClampedArray,
  width: number,
  height: number,
) {
  const imageData = context.createImageData(width, height);
  for (let pixel = 0, index = 0; pixel < gray.length; pixel += 1, index += 4) {
    imageData.data[index] = gray[pixel];
    imageData.data[index + 1] = gray[pixel];
    imageData.data[index + 2] = gray[pixel];
    imageData.data[index + 3] = 255;
  }
  context.putImageData(imageData, 0, 0);
}

function countFilledFields(candidates: ContactCandidates) {
  return Object.values(candidates).filter(Boolean).length;
}

// Measured live: creating and terminating a fresh Tesseract worker per scan
// cost 8-12s of WASM/language-data setup on every single capture, which was
// most of the wait between pressing Scan and seeing prefilled fields - and
// it repeated on every visitor, including "Scan next". Tesseract's own
// guidance is to keep one worker alive across recognize() calls; this holds
// exactly one for the page's lifetime instead of one per scan.
let ocrWorkerPromise: ReturnType<
  typeof import('tesseract.js').createWorker
> | null = null;
// tesseract.js only accepts a logger at worker-creation time, and this
// worker is created once for the whole page session - so the logger it's
// given must forward to whichever scan is currently running, not whichever
// scan happened to be first.
let ocrProgressSink: ((progress: number) => void) | null = null;
async function ocrWorker(
  createWorker: typeof import('tesseract.js').createWorker,
) {
  if (!ocrWorkerPromise) {
    ocrWorkerPromise = createWorker('eng', 1, {
      workerPath: '/tesseract/worker.min.js',
      corePath: '/tesseract-core',
      langPath: '/tessdata',
      logger: (message) => {
        if (message.status === 'recognizing text')
          ocrProgressSink?.(
            Math.max(0, Math.min(1, Number(message.progress) || 0)),
          );
      },
    }).catch((error: unknown) => {
      // Don't cache a failed init - the next scan should retry cleanly
      // rather than fail forever for the rest of the session.
      ocrWorkerPromise = null;
      throw error;
    });
  }
  return ocrWorkerPromise;
}

async function readContactImageLocally(
  file: File,
  onProgress: (progress: number) => void,
): Promise<ContactCandidates> {
  const [{ createWorker, PSM }, { default: jsQR }] = await Promise.all([
    import('tesseract.js'),
    import('jsqr'),
  ]);
  const bitmap = await createImageBitmap(file);
  // Business-card photos are often small crops; upscale generously so thin
  // strokes and small print survive OCR, without blowing up large scans.
  const scale = Math.max(1, Math.min(4, 2800 / bitmap.width));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Image processing is unavailable.');
  context.fillStyle = '#fff';
  context.fillRect(0, 0, width, height);
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const original = context.getImageData(0, 0, width, height);
  const code = jsQR(original.data, original.width, original.height, {
    inversionAttempts: 'attemptBoth',
  });
  const gray = grayscaleValues(original);

  // Pass 1: contrast-boosted grayscale — keeps mid-tones for stylized fonts.
  const contrasted = new Uint8ClampedArray(gray.length);
  for (let pixel = 0; pixel < gray.length; pixel += 1) {
    contrasted[pixel] = Math.max(
      0,
      Math.min(255, (gray[pixel] - 128) * 1.45 + 128),
    );
  }
  paintGrayscale(context, contrasted, width, height);

  const worker = await ocrWorker(createWorker);
  // Route the shared worker's progress events to this call's onProgress
  // for as long as this scan is the one running, and hand the sink back
  // whether this call succeeds, fails, or a newer scan preempts it.
  ocrProgressSink = (fraction) => onProgress(fraction * 0.6);
  try {
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.SPARSE_TEXT,
      preserve_interword_spaces: '1',
    });
    const firstPass = await worker.recognize(canvas);
    let ocr = extractContactCandidates(firstPass.data.text);

    // Pass 2: Otsu-binarized image, run only if the first pass came up
    // short. This tends to recover text on colored/gradient card
    // backgrounds that a fixed contrast curve doesn't fully separate from
    // the ink.
    if (countFilledFields(ocr) < 3) {
      const threshold = otsuThreshold(gray);
      const binarized = new Uint8ClampedArray(gray.length);
      for (let pixel = 0; pixel < gray.length; pixel += 1) {
        binarized[pixel] = gray[pixel] < threshold ? 0 : 255;
      }
      paintGrayscale(context, binarized, width, height);
      await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO });
      ocrProgressSink = (fraction) => onProgress(0.6 + fraction * 0.4);
      const secondPass = await worker.recognize(canvas);
      onProgress(1);
      const secondOcr = extractContactCandidates(secondPass.data.text);
      ocr = mergeContactCandidates(ocr, secondOcr);
    } else {
      onProgress(1);
    }

    const encoded = code?.data
      ? extractEncodedContact(code.data)
      : extractContactCandidates('');
    return mergeContactCandidates(encoded, ocr);
  } finally {
    ocrProgressSink = null;
  }
}

function VisitorCapture({
  activeEvent,
  onSaved,
  setNotice,
  onGoToEventHome,
}: {
  activeEvent: EventItem | undefined;
  onSaved: () => void;
  setNotice: (message: string) => void;
  onGoToEventHome: () => void;
}) {
  const form = useRef<HTMLFormElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [reading, setReading] = useState(false);
  const [ocrStatus, setOcrStatus] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleFile(event: SyntheticEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    setReading(true);
    setOcrStatus('Reading text and QR data on this device…');
    try {
      const candidates = await readContactImageLocally(file, (progress) =>
        setOcrStatus(`Reading on this device… ${Math.round(progress * 100)}%`),
      );
      let filled = 0;
      for (const [field, value] of Object.entries(candidates)) {
        if (!value) continue;
        const control = form.current?.elements.namedItem(field);
        if (!(control instanceof HTMLInputElement) || control.value.trim())
          continue;
        control.value = value;
        filled += 1;
      }
      setOcrStatus(
        filled
          ? `${filled} field${filled === 1 ? '' : 's'} prefilled · verify before saving`
          : 'No reliable contact fields were found. Enter the details manually.',
      );
    } catch {
      setOcrStatus('This image could not be read locally. Enter details manually.');
    } finally {
      setReading(false);
    }
  }

  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeEvent) return;
    const formEl = event.currentTarget;
    const data = new FormData(formEl);
    data.set('clientCaptureId', crypto.randomUUID());
    setSaving(true);
    try {
      const response = await apiFetch('/api/leads', {
        method: 'POST',
        body: data,
      });
      const result = (await response.json()) as {
        lead?: { fullName: string };
        error?: string;
      };
      if (!response.ok || !result.lead) {
        setNotice(result.error || 'Unable to save this contact.');
        return;
      }
      setNotice(`${result.lead.fullName} saved to My contacts`);
      formEl.reset();
      setOcrStatus('');
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  if (!activeEvent) {
    return (
      <div className="visitor-placeholder">
        <article className="panel empty-state large">
          <CalendarDays />
          <h2>No active event</h2>
          <p>Join or create an event before capturing a contact.</p>
          <Button type="button" onClick={onGoToEventHome}>
            Go to Event home
          </Button>
        </article>
      </div>
    );
  }

  return (
    <div className="visitor-placeholder">
      <article className="panel">
        <div className="settings-heading">
          <Camera />
          <div>
            <h2>Capture a contact</h2>
            <p>
              Attending {activeEvent.name}. Scan a card or badge, or enter
              the basics manually — saved privately to your visitor
              workspace.
            </p>
          </div>
        </div>
        <div className="capture-methods">
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={reading}
          >
            <Camera size={20} />
            <span>
              <strong>Upload card or badge</strong>
              <small>Choose or photograph an image</small>
            </span>
          </button>
        </div>
        <input
          type="file"
          accept="image/*"
          hidden
          ref={fileInput}
          onChange={handleFile}
          disabled={reading}
        />
        {ocrStatus ? (
          <p className={`local-ocr-status ${reading ? '' : 'ready'}`}>
            {reading ? <span className="local-ocr-spinner" /> : <Check size={15} />}
            {ocrStatus}
          </p>
        ) : null}
        <div className="or">
          <span>or enter the basics</span>
        </div>
        <form className="lead-form" ref={form} onSubmit={submit}>
          <div className="field-grid">
            <div className="field-block">
              <label htmlFor="visitor-lead-name">Full name</label>
              <Input id="visitor-lead-name" name="fullName" required />
            </div>
            <div className="field-block">
              <label htmlFor="visitor-lead-company">Company</label>
              <Input id="visitor-lead-company" name="company" required />
            </div>
          </div>
          <div className="field-block">
            <label htmlFor="visitor-lead-role">Role</label>
            <Input id="visitor-lead-role" name="role" />
          </div>
          <div className="field-grid">
            <div className="field-block">
              <label htmlFor="visitor-lead-email">Work email</label>
              <Input id="visitor-lead-email" name="email" type="email" />
            </div>
            <div className="field-block">
              <label htmlFor="visitor-lead-phone">Phone / WhatsApp</label>
              <Input id="visitor-lead-phone" name="phone" type="tel" />
            </div>
          </div>
          <div className="field-block">
            <label htmlFor="visitor-lead-note">
              Notes — what did they say, what did you promise?
            </label>
            <Textarea id="visitor-lead-note" name="note" />
          </div>
          <Button type="submit" className="save-button" disabled={saving}>
            {saving ? 'Saving…' : 'Save contact'}
          </Button>
        </form>
      </article>
    </div>
  );
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
  const [auditPage, setAuditPage] = useState(0);
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
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const [accountFilter, setAccountFilter] = useState('');
  const [leadScope, setLeadScope] = useState('all');
  const [peopleTab, setPeopleTab] = useState<'accounts' | 'contacts'>(
    'contacts',
  );
  const [peopleQuery, setPeopleQuery] = useState('');
  const [peopleClass, setPeopleClass] = useState('all');
  const [peopleSort, setPeopleSort] = useState('recent');
  const [peoplePage, setPeoplePage] = useState(0);
  const [knowledgeDialog, setKnowledgeDialog] = useState<string | null>(
    null,
  );
  /* window.prompt/confirm are unsupported in this runtime, so the flows that
     relied on them threw instead of asking. One dialog serves them all. */
  const [askState, setAskState] = useState<AskRequest | null>(null);
  const askUser = (config: AskConfig) =>
    new Promise<Record<string, string> | null>((resolve) =>
      setAskState({ ...config, resolve }),
    );
  function closeAsk(values: Record<string, string> | null) {
    askState?.resolve(values);
    setAskState(null);
  }
  const topbarActionsRef = useRef<HTMLDivElement>(null);
  const workspaceMenuRef = useRef<HTMLDivElement>(null);
  const [leadComments, setLeadComments] = useState<LeadComment[]>([]);
  const [commentMentions, setCommentMentions] = useState<string[]>([]);
  const [postingComment, setPostingComment] = useState(false);
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
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  // Clicking a failed readiness check opens a tiny form with only the
  // field(s) that check actually validates, instead of the full event
  // form. Everything else the event already has is carried forward as
  // hidden inputs with its current value, since the update endpoint
  // overwrites every column on every save - nothing is dropped.
  const [quickFixTarget, setQuickFixTarget] = useState<{
    item: EventItem;
    checkKey: string;
    label: string;
    detail: string;
  } | null>(null);
  const [rfqDialogOpen, setRfqDialogOpen] = useState(false);
  const [quotationDialogOpen, setQuotationDialogOpen] = useState(false);
  const [meetingDialogOpen, setMeetingDialogOpen] = useState(false);
  const [similarEventMatches, setSimilarEventMatches] = useState<
    EventItem[]
  >([]);
  const [directoryEntries, setDirectoryEntries] = useState<DirectoryEntry[]>(
    [],
  );
  const [directoryQuery, setDirectoryQuery] = useState('');
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const [itineraryItems, setItineraryItems] = useState<ItineraryItem[]>([]);
  const [memoryQuery, setMemoryQuery] = useState('');
  const [showArchivedContacts, setShowArchivedContacts] = useState(false);
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
  const [readingAttachment, setReadingAttachment] = useState(false);
  const [localOcrFields, setLocalOcrFields] = useState<string[]>([]);
  const [localOcrStatus, setLocalOcrStatus] = useState('');
  const [moreDetailsOpen, setMoreDetailsOpen] = useState(false);
  const [acceptedCaptureFields, setAcceptedCaptureFields] = useState<string[]>(
    [],
  );
  /* Adding an audio note or a brochure to an already-saved lead, from the
     review panel. Independent of the primary capture attachment above,
     which only ever holds one file for the lead being created. */
  const [reviewRecording, setReviewRecording] = useState(false);
  const [attachingReviewAsset, setAttachingReviewAsset] = useState<
    '' | 'audio' | 'document'
  >('');
  const [rfqs, setRfqs] = useState<RfqItem[]>([]);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [processingRfq, setProcessingRfq] = useState('');
  /* The RFQ workspace has no URL route of its own - every view in this app is
     state driven - so the open RFQ is held by id and always re-read from the
     loaded list, never from a snapshot captured at click time. */
  const [openRfqId, setOpenRfqId] = useState('');
  const [knowledgeState, setKnowledgeState] = useState<
    'idle' | 'loading' | 'ready' | 'error'
  >('idle');
  const [eventTab, setEventTab] = useState('all');
  const [eventQuery, setEventQuery] = useState('');
  const [eventSort, setEventSort] = useState('recent');
  const [rfqState, setRfqState] = useState<'idle' | 'loading' | 'ready' | 'error'>(
    'idle',
  );
  const [attachment, setAttachment] = useState<{
    name: string;
    url: string;
    kind: 'card' | 'badge' | 'qr' | 'audio';
    file: File;
  } | null>(null);
  const [recording, setRecording] = useState(false);
  /* One scan surface, not three near-identical upload buttons: card, badge
     and QR all go through the same local OCR+QR pipeline and the same
     server-side vision extraction, so there is nothing for the user to
     choose between. */
  const scanInput = useRef<HTMLInputElement>(null);
  const leadForm = useRef<HTMLFormElement>(null);
  const eventGateRef = useRef<HTMLOutputElement>(null);
  const leadDraftRef = useRef<Record<string, string> | null>(null);
  const eventForm = useRef<HTMLFormElement>(null);
  const reviewContactForm = useRef<HTMLFormElement>(null);
  const reviewDocInput = useRef<HTMLInputElement>(null);
  const reviewRecorder = useRef<MediaRecorder | null>(null);
  const reviewAudioChunks = useRef<Blob[]>([]);
  const recorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const ocrRun = useRef(0);
  const previousWorkspaceKind = useRef<string | null>(null);

  useEffect(() => {
    const kind = appContext?.workspace.kind;
    if (!kind || previousWorkspaceKind.current === kind) return;
    previousWorkspaceKind.current = kind;
    setActiveView(kind === 'visitor' ? 'visitor-home' : 'today');
    setReviewLead(null);
  }, [appContext?.workspace.kind]);

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
      if (data.context) {
        setAppContext(data.context);
        window.localStorage.setItem(
          'revenue-workspace-id',
          data.context.workspace.id,
        );
      }
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
        const storedEventId =
          window.localStorage.getItem('revenue-event-id') || '';
        const activeEvents = data.events.filter(
          (item) => item.status === 'active',
        );
        const selectedEvent =
          activeEvents.find((item) => item.id === storedEventId) ||
          (activeEvents.length === 1 ? activeEvents[0] : null);
        if (!selectedEvent) {
          window.localStorage.removeItem('revenue-event-id');
          setActiveEventId('');
        } else if (!selectedEvent.deviceConfig || !selectedEvent.configHash) {
          // No booth-readiness snapshot exists for this event (always true
          // for a visitor's personal event) — nothing to verify against.
          window.localStorage.setItem('revenue-event-id', selectedEvent.id);
          setActiveEventId(selectedEvent.id);
        } else {
          const workspaceId =
            window.localStorage.getItem('revenue-workspace-id') || '';
          try {
            if (!workspaceId)
              throw new Error('Workspace context is unavailable.');
            await cacheEventConfig(workspaceId, selectedEvent);
            window.localStorage.setItem('revenue-event-id', selectedEvent.id);
            setActiveEventId(selectedEvent.id);
          } catch {
            window.localStorage.removeItem('revenue-event-id');
            setActiveEventId('');
            setNotice(
              'Event configuration verification failed. Choose the event again.',
            );
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
  async function markNotificationRead(id: string) {
    setOperations((current) =>
      current
        ? {
            ...current,
            notifications: current.notifications.map((item) =>
              item.id === id ? { ...item, readAt: Date.now() } : item,
            ),
          }
        : current,
    );
    await apiFetch('/api/operations', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'read_notification', id }),
    });
  }
  async function loadKnowledge() {
    setKnowledgeState((current) => (current === 'ready' ? current : 'loading'));
    const response = await apiFetch('/api/company-intelligence');
    if (!response.ok) {
      /* A failed load used to fall through to the empty arrays, so a broken
         request looked exactly like an unconfigured workspace. */
      setKnowledgeState('error');
      return;
    }
    setKnowledge((await response.json()) as KnowledgeData);
    setKnowledgeState('ready');
  }
  async function loadRfqs() {
    setRfqState((current) => (current === 'ready' ? current : 'loading'));
    const response = await apiFetch('/api/rfqs');
    if (!response.ok) {
      setRfqState('error');
      return;
    }
    const data = (await response.json()) as { rfqs: RfqItem[] };
    setRfqs(data.rfqs);
    setRfqState('ready');
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
      void (async () => {
        await loadWorkspace();
        await loadEvents();
        await Promise.all([
          loadWorkspace(),
          loadReports(),
          loadOperations(),
          refreshOutbox(),
        ]);
      })().finally(() => setInitializing(false));
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
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    if (!notificationsOpen && !profileOpen && !workspaceMenuOpen) return;
    const dismiss = () => {
      setNotificationsOpen(false);
      setProfileOpen(false);
      setWorkspaceMenuOpen(false);
    };
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        !topbarActionsRef.current?.contains(target) &&
        !workspaceMenuRef.current?.contains(target)
      )
        dismiss();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') dismiss();
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [notificationsOpen, profileOpen, workspaceMenuOpen]);
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
    if (view === 'visitor-discover') void searchDirectory(directoryQuery);
    if (view === 'visitor-plan' && activeEventId)
      void loadItinerary(activeEventId);
  }

  async function saveLead(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeEvent) {
      eventGateRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
      eventGateRef.current?.classList.add('shake');
      setTimeout(() => eventGateRef.current?.classList.remove('shake'), 500);
      return;
    }
    const formEl = event.currentTarget;
    const fieldValue = (name: string) => {
      const value = new FormData(formEl).get(name);
      return typeof value === 'string' ? value.trim() : '';
    };
    const missing: string[] = [];
    if (!attachment && !fieldValue('fullName')) missing.push('Full name');
    if (!attachment && !fieldValue('company')) missing.push('Company');
    const emailValue = fieldValue('email');
    if (emailValue && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(emailValue)) {
      setNotice('Enter a valid work email address.');
      setTimeout(() => setNotice(''), 2600);
      return;
    }
    if (missing.length) {
      setNotice(`Please fill in: ${missing.join(', ')}`);
      setTimeout(() => setNotice(''), 2600);
      return;
    }
    setSaving(true);
    setCaptureProgress('Saving the original…');
    setSaveError('');
    setCaptureOutcome('');
    const form = new FormData(event.currentTarget);
    form.set('clientCaptureId', crypto.randomUUID());
    if (localOcrFields.length) {
      form.set('localOcrConfirmed', 'true');
      form.set('localOcrFields', localOcrFields.join(','));
    }
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
        warning?: string | null;
      };
      if (!response.ok || !data.lead) {
        setSaveError(data.error || 'Unable to save this lead.');
        return;
      }
      setSavedLead(data.lead);
      setCapturedLeads((current) => [data.lead!, ...current]);
      void loadWorkspace();
      if (data.warning) {
        // File storage is unavailable in this environment - the backend
        // already fell back to saving the contact fields only. Say so
        // plainly rather than the normal "original saved" messaging, which
        // would be false here.
        setCaptureOutcome(data.warning);
      } else if (attachment && localOcrFields.length) {
        setCaptureOutcome(
          'The on-device OCR fields and original image are saved. You can correct the contact at any time from People.',
        );
      } else if (attachment && data.lead.captureStatus) {
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
              ? attachment.kind === 'audio'
                ? 'Audio recorded ✓ — transcription is unavailable in this test environment. The recording is saved; enter the conversation details manually.'
                : 'The original is saved. AI assistance is unavailable in this test environment, so you can review and enter the details manually.'
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
        // eslint-disable-next-line react/react-compiler -- inside an onSubmit handler, never invoked during render
        const queuedAt = Date.now();
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
            queuedAt,
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
          createdAt: queuedAt,
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
      leadDraftRef.current = null;
      if (recording) recorder.current?.stop();
      setTimeout(() => {
        if (attachment?.url) URL.revokeObjectURL(attachment.url);
        setAttachment(null);
        setSaved(false);
        setSavedLead(null);
        setSaveError('');
        setCaptureProgress('');
        setCaptureOutcome('');
        setReadingAttachment(false);
        setLocalOcrFields([]);
        setLocalOcrStatus('');
        setMoreDetailsOpen(false);
        ocrRun.current += 1;
      }, 150);
    }
  }
  // Snapshot whatever the user has typed so it survives the round trip to
  // Events when they leave mid-capture to set up or activate one.
  function stashLeadDraft() {
    if (!leadForm.current) return;
    const snapshot: Record<string, string> = {};
    new FormData(leadForm.current).forEach((value, key) => {
      if (typeof value === 'string' && value) snapshot[key] = value;
    });
    if (Object.keys(snapshot).length) leadDraftRef.current = snapshot;
  }
  useEffect(() => {
    if (!captureOpen || !leadDraftRef.current) return;
    const snapshot = leadDraftRef.current;
    leadDraftRef.current = null;
    const timer = window.setTimeout(() => {
      const form = leadForm.current;
      if (!form) return;
      for (const [key, value] of Object.entries(snapshot)) {
        const control = form.elements.namedItem(key);
        if (control instanceof HTMLInputElement) {
          if (control.type === 'checkbox') control.checked = true;
          else control.value = value;
        } else if (control instanceof HTMLTextAreaElement) {
          control.value = value;
        }
      }
      setNotice('Your entries were restored.');
      setTimeout(() => setNotice(''), 2000);
    }, 50);
    return () => window.clearTimeout(timer);
  }, [captureOpen]);

  async function prefillContactFromImage(file: File) {
    const run = ++ocrRun.current;
    setReadingAttachment(true);
    setLocalOcrFields([]);
    setLocalOcrStatus('Reading text and QR data on this device…');
    try {
      const candidates = await readContactImageLocally(file, (progress) => {
        if (run === ocrRun.current)
          setLocalOcrStatus(
            `Reading on this device… ${Math.round(progress * 100)}%`,
          );
      });
      if (run !== ocrRun.current) return;
      const filled: string[] = [];
      for (const [field, value] of Object.entries(candidates)) {
        if (!value) continue;
        const control = leadForm.current?.elements.namedItem(field);
        if (!(control instanceof HTMLInputElement) || control.value.trim())
          continue;
        control.value = value;
        filled.push(field);
      }
      setLocalOcrFields(filled);
      // Role lives behind "More details" - if OCR filled it, that
      // disclosure must open, or the user would be saving a field they
      // never saw and never got the chance to correct.
      if (filled.includes('role')) setMoreDetailsOpen(true);
      setLocalOcrStatus(
        filled.length
          ? `${filled.length} field${filled.length === 1 ? '' : 's'} prefilled on this device · verify before saving`
          : 'No reliable contact fields were found. Retake a sharper, closer photo or enter the basics manually.',
      );
    } catch {
      if (run === ocrRun.current)
        setLocalOcrStatus(
          'This image could not be read locally. Retake a sharper photo or enter the basics manually.',
        );
    } finally {
      if (run === ocrRun.current) setReadingAttachment(false);
    }
  }

  function selectAttachment(event: SyntheticEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    if (attachment?.url) URL.revokeObjectURL(attachment.url);
    // The scan surface no longer asks whether this is a card, badge, or QR
    // code - the same OCR+QR pass reads all three, and the server-side
    // vision fallback prompt reads generically either way. 'card' is simply
    // the stored kind for "an image was scanned".
    setAttachment({
      name: file.name,
      url: URL.createObjectURL(file),
      kind: 'card',
      file,
    });
    setSaveError('');
    void prefillContactFromImage(file);
  }

  function loadDemoCard() {
    ocrRun.current += 1;
    setReadingAttachment(false);
    setLocalOcrFields([]);
    setLocalOcrStatus('Preparing the sample for on-device OCR…');
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
      void prefillContactFromImage(file);
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

  // Closes the capture dialog and reopens it a moment later, ready for the
  // next visitor. This is the fast path the whole capture flow is built
  // around: confirm one person, immediately be ready for the next.
  function scanNext() {
    resetCapture(false);
    window.setTimeout(() => setCaptureOpen(true), 200);
  }

  async function attachReviewAsset(
    leadId: string,
    kind: 'audio' | 'document',
    file: File,
  ) {
    setAttachingReviewAsset(kind);
    const form = new FormData();
    form.set('action', 'attach_capture');
    form.set('leadId', leadId);
    form.set('attachmentKind', kind);
    form.set('attachment', file);
    try {
      const response = await apiFetch('/api/leads', {
        method: 'POST',
        body: form,
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setNotice(data.error || 'Could not attach this file.');
        return;
      }
      setNotice(
        kind === 'audio'
          ? 'Audio note attached · reading it now…'
          : 'Brochure attached to this lead',
      );
      if (kind === 'audio') {
        // Reuses the same extraction endpoint the initial capture uses -
        // it already operates on a lead's most recently added asset, so
        // the freshly attached recording is exactly what gets transcribed.
        await processCapture();
      } else {
        void loadWorkspace();
      }
    } finally {
      setAttachingReviewAsset('');
    }
  }

  async function toggleReviewRecording() {
    if (!reviewLead) return;
    if (reviewRecording) {
      reviewRecorder.current?.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      const nextRecorder = new MediaRecorder(stream);
      reviewAudioChunks.current = [];
      nextRecorder.ondataavailable = (event) => {
        if (event.data.size) reviewAudioChunks.current.push(event.data);
      };
      nextRecorder.onstop = () => {
        const blob = new Blob(reviewAudioChunks.current, {
          type: nextRecorder.mimeType || 'audio/webm',
        });
        stream.getTracks().forEach((track) => track.stop());
        setReviewRecording(false);
        const lead = reviewLead;
        if (!lead || !blob.size) return;
        const file = new File([blob], `note-${Date.now()}.webm`, {
          type: blob.type,
        });
        void attachReviewAsset(lead.id, 'audio', file);
      };
      reviewRecorder.current = nextRecorder;
      nextRecorder.start();
      setReviewRecording(true);
    } catch {
      setNotice('Microphone access was not available.');
    }
  }

  function selectReviewDocument(event: SyntheticEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file || !reviewLead) return;
    void attachReviewAsset(reviewLead.id, 'document', file);
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
    setLeadComments([]);
    setCommentMentions([]);
    void loadFollowups(lead.id);
    void loadComments(lead.id);
    void loadSettings();
  }
  function openVisitorContact(lead: SavedLead) {
    setActiveView('visitor-followups');
    setReviewLead(lead);
    setAnalysisError('');
    setFollowups([]);
    void loadFollowups(lead.id);
  }
  async function loadComments(leadId: string) {
    const response = await apiFetch(
      `/api/comments?leadId=${encodeURIComponent(leadId)}`,
    );
    if (response.ok) {
      const data = (await response.json()) as { comments: LeadComment[] };
      setLeadComments(data.comments);
    }
  }
  async function postComment(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reviewLead) return;
    const form = event.currentTarget;
    const text = new FormData(form).get('body');
    if (typeof text !== 'string' || !text.trim()) return;
    setPostingComment(true);
    const response = await apiFetch('/api/comments', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        leadId: reviewLead.id,
        body: text.trim(),
        mentions: commentMentions,
      }),
    });
    const data = (await response.json()) as {
      comment?: LeadComment;
      error?: string;
    };
    setPostingComment(false);
    if (!response.ok || !data.comment) {
      setNotice(data.error || 'Could not post the comment.');
      return;
    }
    setLeadComments((current) => [...current, data.comment!]);
    setCommentMentions([]);
    form.reset();
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
    setFollowups((current) =>
      current.map((item) =>
        item.id === draft.id
          ? { ...item, status: 'handed_off', handedOffAt: authorized.handedOffAt }
          : item,
      ),
    );
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
    if (!source.duplicateLeadId) return;
    const confirmed = await askUser({
      title: 'Merge duplicate contact',
      description: `Merge ${source.fullName} into ${source.duplicateLeadName || 'the existing contact'}? You can undo this from People.`,
      confirmLabel: 'Merge contacts',
    });
    if (!confirmed) return;
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
    if (!reviewLead) return;
    const confirmed = await askUser({
      title: 'Erase personal data',
      description: `Erase personal data for ${reviewLead.fullName}? Conversation notes, tasks, AI facts, drafts, and capture files will be permanently removed. Company-level revenue records will remain.`,
      confirmLabel: 'Erase permanently',
      destructive: true,
    });
    if (!confirmed) return;
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
    const needsReason =
      stage === 'lost' ||
      (['won', 'lost'].includes(item.stage) && stage !== item.stage);
    if (needsReason) {
      const answer = await askUser({
        title:
          stage === 'lost'
            ? 'Why was this opportunity lost?'
            : 'Why is this closed opportunity changing?',
        description: 'This reason is retained in the opportunity history.',
        fields: [
          {
            name: 'reason',
            label: 'Reason',
            type: 'textarea',
            defaultValue: stage === 'lost' ? item.lossReason || '' : '',
            required: true,
          },
        ],
        confirmLabel: 'Save reason',
      });
      if (answer === null) return;
      reason = answer.reason;
    }
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
    const answer = await askUser({
      title: 'Update opportunity value',
      fields: [
        {
          name: 'value',
          label: `Value (${item.currency})`,
          type: 'number',
          defaultValue: String(item.value),
          required: true,
        },
      ],
      confirmLabel: 'Update value',
    });
    if (answer === null) return;
    const value = Number(answer.value);
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

  async function analyzeConversation(leadOverride?: SavedLead) {
    const lead = leadOverride || reviewLead;
    if (!lead) return;
    setAnalyzing(true);
    setAnalysisError('');
    try {
      const response = await apiFetch('/api/analysis', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ leadId: lead.id }),
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
  // "Prepare follow-up" on the success screen jumps straight into the
  // review dialog and runs the first analysis step automatically instead of
  // making the user press Analyze themselves - the lead is passed directly
  // rather than read back from state, since state from openReview() hasn't
  // committed yet when this runs.
  function prepareFollowup(lead: SavedLead) {
    resetCapture(false);
    window.setTimeout(() => {
      openReview(lead);
      if (lead.note) void analyzeConversation(lead);
    }, 180);
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
    setMeetingDialogOpen(false);
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

  async function enterVisitorMode() {
    const response = await apiFetch('/api/settings', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'ensure_visitor_workspace' }),
    });
    const data = (await response.json()) as {
      workspace?: AppContext['workspace'];
      error?: string;
    };
    if (!response.ok || !data.workspace) {
      setNotice(data.error || 'Could not open your visitor workspace.');
      return;
    }
    setActiveView('visitor-home');
    await switchWorkspace(data.workspace.id);
  }

  async function switchWorkspace(id: string) {
    window.localStorage.setItem('revenue-workspace-id', id);
    window.localStorage.removeItem('revenue-event-id');
    setActiveEventId('');
    // Clear everything scoped to the previous workspace immediately so
    // nothing stale (next-best-actions, revenue figures) lingers on screen
    // while the new workspace's data is still loading.
    setNextBestActions([]);
    setRevenueReport(null);
    setEventCosts([]);
    setOperations(null);
    setNotice('Workspace switched');
    await Promise.all([
      loadWorkspace(),
      loadSettings(),
      loadEvents(),
      loadReports(),
      loadOperations(),
    ]);
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
    setKnowledgeDialog(null);
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
    const confirmed = await askUser({
      title: 'Remove ' + label,
      description: 'This change cannot be undone.',
      confirmLabel: 'Remove',
      destructive: true,
    });
    if (!confirmed) return;
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
    const isEditing = Boolean(editingEventId);
    const response = await apiFetch('/api/events', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: isEditing ? 'update' : 'create',
        ...(isEditing ? { id: editingEventId } : {}),
        ...values,
      }),
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setNotice(data.error || `Could not ${isEditing ? 'update' : 'create'} event`);
      return;
    }
    form.reset();
    setEditingEventId(null);
    setSimilarEventMatches([]);
    setEventDialogOpen(false);
    setNotice(
      isEditing
        ? 'Event updated · run readiness again before activating'
        : 'Event created · run readiness, then activate it for capture',
    );
    setQuickFixTarget(null);
    await loadEvents();
  }
  function openEventQuickFix(
    item: EventItem,
    check: { key: string; label: string; detail: string },
  ) {
    setEditingEventId(item.id);
    setQuickFixTarget({
      item,
      checkKey: check.key,
      label: check.label,
      detail: check.detail,
    });
  }
  function closeEventQuickFix(open: boolean) {
    if (open) return;
    setQuickFixTarget(null);
    setEditingEventId(null);
  }
  function newEvent() {
    setEditingEventId(null);
    setSimilarEventMatches([]);
    eventForm.current?.reset();
    setEventDialogOpen(true);
  }
  function checkSimilarEvents(typedName: string) {
    const typed = typedName.trim().toLowerCase();
    if (typed.length < 3) {
      setSimilarEventMatches([]);
      return;
    }
    setSimilarEventMatches(
      events.filter(
        (item) =>
          item.id !== editingEventId &&
          item.status !== 'archived' &&
          (item.name.trim().toLowerCase() === typed ||
            item.name.toLowerCase().includes(typed) ||
            typed.includes(item.name.trim().toLowerCase())),
      ),
    );
  }
  function editEvent(item: EventItem) {
    setEditingEventId(item.id);
    setSimilarEventMatches([]);
    setEventDialogOpen(true);
    setTimeout(() => {
      const form = eventForm.current;
      if (!form) return;
      const setField = (name: string, value: string) => {
        const control = form.elements.namedItem(name);
        if (
          control instanceof HTMLInputElement ||
          control instanceof HTMLTextAreaElement
        )
          control.value = value;
      };
      setField('name', item.name);
      setField('venue', item.venue || '');
      setField('hall', item.hall || '');
      setField('booth', item.booth || '');
      setField('timezone', item.timezone);
      setField('startsOn', item.startsOn);
      setField('endsOn', item.endsOn);
      setField('objective', item.objective || '');
      setField('products', item.products.join(', '));
      setField('targetAccounts', item.targetAccounts.join(', '));
      setField(
        'qualificationQuestions',
        item.qualificationQuestions.join(', '),
      );
      setField('leadFieldSchema', item.leadFieldSchema.join(', '));
      setField('budget', String(item.budget));
      setField('attributionWindowDays', String(item.attributionWindowDays));
      setField(
        'grossMarginPercent',
        String(Math.round(item.grossMarginBps / 100)),
      );
      setField('badgeProvider', item.badgeProvider || '');
      setField('followupSlaHours', String(item.followupSlaHours));
      setField('dailyLeadTarget', String(item.dailyLeadTarget));
      form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
  }
  function cancelEditEvent() {
    setEditingEventId(null);
    eventForm.current?.reset();
  }
  function closeEventDialog(open: boolean) {
    setEventDialogOpen(open);
    if (!open) {
      setEditingEventId(null);
      setSimilarEventMatches([]);
      eventForm.current?.reset();
    }
  }

  async function createVisitorEvent(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    const response = await apiFetch('/api/events', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'create_visitor_event', ...values }),
    });
    const data = (await response.json()) as { id?: string; error?: string };
    if (!response.ok || !data.id) {
      setNotice(data.error || 'Could not create this event.');
      return;
    }
    form.reset();
    setNotice('Event added');
    await loadEvents();
  }

  async function joinEventByCode(code: string) {
    const response = await apiFetch('/api/events', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'join_canonical_event', code }),
    });
    const data = (await response.json()) as {
      id?: string;
      duplicate?: boolean;
      error?: string;
    };
    if (!response.ok || !data.id) {
      setNotice(data.error || 'Could not find an event for that code.');
      return;
    }
    setNotice(
      data.duplicate ? "You're already attending that event" : 'Event joined',
    );
    await loadEvents();
  }
  async function joinCanonicalEvent(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const codeValue = new FormData(form).get('code');
    const code = typeof codeValue === 'string' ? codeValue.trim() : '';
    if (!code) return;
    await joinEventByCode(code);
    form.reset();
  }
  async function searchDirectory(query: string) {
    setDirectoryLoading(true);
    try {
      const response = await apiFetch(
        `/api/directory?query=${encodeURIComponent(query)}`,
      );
      if (response.ok) {
        const data = (await response.json()) as {
          entries: DirectoryEntry[];
        };
        setDirectoryEntries(data.entries);
      }
    } finally {
      setDirectoryLoading(false);
    }
  }

  async function loadItinerary(eventId: string) {
    const response = await apiFetch(
      `/api/itinerary?eventId=${encodeURIComponent(eventId)}`,
    );
    if (response.ok) {
      const data = (await response.json()) as { items: ItineraryItem[] };
      setItineraryItems(data.items);
    }
  }
  async function addItineraryItem(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeEvent) return;
    const formEl = event.currentTarget;
    const values = Object.fromEntries(new FormData(formEl).entries());
    const response = await apiFetch('/api/itinerary', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'add',
        eventId: activeEvent.id,
        ...values,
      }),
    });
    const data = (await response.json()) as { id?: string; error?: string };
    if (!response.ok || !data.id) {
      setNotice(data.error || 'Could not add this to your plan.');
      return;
    }
    formEl.reset();
    setNotice('Added to your plan');
    await loadItinerary(activeEvent.id);
  }
  async function updateItineraryStatus(id: string, status: string) {
    const response = await apiFetch('/api/itinerary', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'update_status', id, status }),
    });
    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      setNotice(data.error || 'Could not update this plan item.');
      return;
    }
    setItineraryItems((current) =>
      current.map((item) =>
        item.id === id
          ? { ...item, status, visitedAt: status === 'visited' ? Date.now() : item.visitedAt }
          : item,
      ),
    );
  }
  async function setRelationshipStatus(lead: SavedLead, status: string) {
    const response = await apiFetch('/api/workspace', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'set_relationship_status',
        id: lead.id,
        status,
      }),
    });
    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      setNotice(data.error || 'Could not update this contact.');
      return;
    }
    setCapturedLeads((current) =>
      current.map((item) =>
        item.id === lead.id ? { ...item, relationshipStatus: status } : item,
      ),
    );
    setNotice(
      status === 'archived' ? 'Relationship archived' : 'Relationship reopened',
    );
  }

  /* One readiness disclosure, shown by the lead event card and by each row in
     the event list. Every value comes from the stored snapshot. */
  function renderEventReadiness(item: EventItem) {
    return (
    item.readinessChecks.length ? (
      /* Nine ticks over three lines dominated the card.
         The count is what you scan for; the detail is one
         click away and nothing is lost. */
      <details className="readiness-disclosure">
        <summary>
          <span>
            {
              item.readinessChecks.filter((c) => c.passed)
                .length
            }{' '}
            of {item.readinessChecks.length} readiness
            checks passed
          </span>
          <ChevronDown size={14} />
        </summary>
      <div className="readiness-checks">
        {item.readinessChecks.map((check) => {
          const fixesInKnowledge = [
            'company_profile',
            'active_offering',
            'ideal_customer',
            'qualification_rules',
            'approved_evidence',
          ].includes(check.key);
          const content = (
            <>
              {check.passed ? (
                <Check />
              ) : (
                <AlertTriangle />
              )}
              {check.label}
            </>
          );
          if (check.passed)
            return (
              <span
                className="passed"
                key={check.key}
                title={check.detail}
              >
                {content}
              </span>
            );
          return (
            <button
              type="button"
              className="blocked"
              key={check.key}
              title={`${check.detail} Click to fix this in ${fixesInKnowledge ? 'Company knowledge' : 'this event'}.`}
              onClick={() =>
                fixesInKnowledge
                  ? go('knowledge')
                  : openEventQuickFix(item, check)
              }
            >
              {content}
            </button>
          );
        })}
      </div>
      </details>
    ) : (
      <small className="readiness-empty">
        Readiness has not been assessed for configuration
        v{item.configVersion}.
      </small>
    )
    );
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

  async function toggleDirectoryVisibility(item: EventItem) {
    const visibility =
      item.directoryVisibility === 'published' ? 'private' : 'published';
    const response = await apiFetch('/api/events', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'set_directory_visibility',
        id: item.id,
        visibility,
      }),
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setNotice(data.error || 'Could not update directory visibility.');
      return;
    }
    setNotice(
      visibility === 'published'
        ? 'Published to the visitor directory'
        : 'Removed from the visitor directory',
    );
    await loadEvents();
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
    setRfqDialogOpen(false);
    setNotice('RFQ intake created');
    await loadRfqs();
  }
  async function updateRfqStatus(item: RfqItem, status: string) {
    const needsReason =
      status === 'clarification' ||
      status === 'lost' ||
      (['won', 'lost'].includes(item.status) && status !== item.status);
    let note = '';
    if (needsReason) {
      const answer = await askUser({
        title:
          status === 'clarification'
            ? 'Request clarification'
            : status === 'lost'
              ? 'Mark this RFQ lost'
              : 'Change a closed RFQ',
        description:
          'The reason is stored in RFQ history and the server rejects an empty one.',
        fields: [
          {
            name: 'note',
            label:
              status === 'clarification'
                ? 'What clarification is required from the customer?'
                : status === 'lost'
                  ? 'Why was this RFQ lost?'
                  : 'Why is this closed RFQ changing?',
            type: 'textarea',
            required: true,
          },
        ],
        confirmLabel: 'Save status',
        destructive: status === 'lost',
      });
      if (answer === null) return;
      note = answer.note.trim();
    }
    if (needsReason && !note) {
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
    const answer = await askUser({
      title: 'Record submission',
      description:
        'This stores a new submission version and moves the RFQ to quoted.',
      fields: [
        {
          name: 'note',
          label:
            'What was submitted? Include the quotation or proposal reference.',
          type: 'textarea',
          required: true,
        },
      ],
      confirmLabel: 'Record submission',
    });
    if (answer === null) return;
    const note = answer.note.trim();
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
  /* One extraction form, rendered by the RFQ list section and the RFQ detail
     page. Every branch below reflects a real rfq_ai_extractions.status. */
  function renderRfqExtraction(item: RfqItem, extraction: RfqExtraction | null) {
    return item.extractionStatus === 'completed' && extraction ? (
      <form
        className="rfq-review-form"
        onSubmit={(event) =>
          confirmRfqExtraction(event, item)
        }
      >
        <p>{extraction.summary}</p>
        <div className="field-grid">
          <div className="field-block">
            <label htmlFor={`rfq-location-${item.id}`}>
              Delivery location
            </label>
            <Input
              id={`rfq-location-${item.id}`}
              name="deliveryLocation"
              defaultValue={
                extraction.deliveryLocation || ''
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
                extraction.submissionDeadline || ''
              }
            />
          </div>
        </div>
        {extraction.items.map((line, index) => (
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
        {extraction.warnings.length ? (
          <small>
            {extraction.warnings.join(' · ')}
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
    );
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
    setQuotationDialogOpen(false);
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
    const revision = await askUser({
      title: 'Revise quotation',
      description:
        'A new version is created for internal approval. The previous version is retained.',
      fields: [
        {
          name: 'amount',
          label: `New amount (${item.currency})`,
          type: 'number',
          defaultValue: String(item.amount),
          required: true,
        },
        {
          name: 'validUntil',
          label: 'Valid until',
          type: 'date',
          defaultValue: item.validUntil || '',
        },
        {
          name: 'note',
          label: 'Why is this being revised?',
          type: 'textarea',
          required: true,
        },
      ],
      confirmLabel: 'Create revision',
    });
    if (revision === null) return;
    const amountValue = revision.amount;
    const amount = Number(amountValue);
    if (!Number.isFinite(amount) || amount <= 0) {
      setNotice('Enter a positive quotation amount.');
      return;
    }
    const validUntil = revision.validUntil;
    if (validUntil && !/^\d{4}-\d{2}-\d{2}$/.test(validUntil)) {
      setNotice('Use YYYY-MM-DD for the valid-until date.');
      return;
    }
    const note = revision.note;
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
    const answer = await askUser({
      title: 'Void cost line',
      description:
        'The line is kept with an immutable reason and version history.',
      fields: [
        {
          name: 'reason',
          label: 'Why should this cost line be voided?',
          type: 'textarea',
          required: true,
        },
      ],
      confirmLabel: 'Void cost line',
      destructive: true,
    });
    if (answer === null) return;
    const reason = answer.reason;
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
      // No booth-readiness snapshot exists for this event (always true for a
      // visitor's personal event) — nothing to verify against.
      if (selected.deviceConfig && selected.configHash) {
        try {
          const workspaceId =
            appContext?.workspace.id ||
            window.localStorage.getItem('revenue-workspace-id') ||
            '';
          if (!workspaceId)
            throw new Error('Workspace context is unavailable.');
          await cacheEventConfig(workspaceId, selected);
        } catch (error) {
          setNotice(
            error instanceof Error
              ? error.message
              : 'Could not cache the event configuration.',
          );
          return;
        }
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
  const capturableEvents = events.filter((item) => item.status === 'active');
  // A rapid-capture queue without any new backend concept: every lead this
  // salesperson hasn't confirmed yet, oldest first, is already exactly that
  // queue. "Scan next" never forces a review; this is how you come back to it.
  const pendingReviewLeads = capturedLeads
    .filter((lead) => lead.reviewStatus === 'needs_review')
    .sort((a, b) => a.createdAt - b.createdAt);
  const reviewCaptureExtraction = captureExtraction(reviewLead?.extractedJson);
  const filteredAccount = accounts.find((item) => item.id === accountFilter);
  /* Mirrors requireRole on every RFQ mutation route. The server stays the
     authority; this only decides whether a dead control is rendered. */
  const canManageRfq = ['owner', 'admin', 'manager', 'salesperson'].includes(
    appContext?.role || '',
  );
  /* Mirrors requireRole on POST /api/events. Selecting the capture event is
     not gated: that is client-side state, not a workspace mutation. */
  const canManageEvents = ['owner', 'admin', 'manager'].includes(
    appContext?.role || '',
  );
  /* Same four signals the banner always counted, named once so the figure and
     the progress line cannot drift apart. */
  const knowledgeSetupDone = [
    knowledge.profile,
    knowledge.products.length,
    knowledge.icps.length,
    knowledge.sources.length,
  ].filter(Boolean).length;
  const currentProfileVersion = knowledge.profileVersions[0];
  /* The event chosen for capture leads the page; everything else is listed
     below it, so the two never show the same record twice. */
  const otherEvents = events.filter((item) => item.id !== activeEvent?.id);
  const eventCounts = {
    all: otherEvents.length,
    active: otherEvents.filter((item) => item.status === 'active').length,
    ready: otherEvents.filter((item) => item.status === 'ready').length,
    draft: otherEvents.filter((item) => item.status === 'draft').length,
    archived: otherEvents.filter((item) => item.status === 'archived').length,
  };
  const eventTerm = eventQuery.trim().toLowerCase();
  const eventRows = otherEvents
    .filter((item) => eventTab === 'all' || item.status === eventTab)
    .filter(
      (item) =>
        !eventTerm ||
        [item.name, item.venue, item.hall, item.booth, item.objective]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(eventTerm),
    )
    .sort((a, b) =>
      eventSort === 'earliest'
        ? a.startsOn.localeCompare(b.startsOn)
        : eventSort === 'az'
          ? a.name.localeCompare(b.name)
          : b.startsOn.localeCompare(a.startsOn),
    );
  const openRfq = rfqs.find((item) => item.id === openRfqId);
  const openRfqQuotations = quotations.filter(
    (quote) => quote.rfqId === openRfqId,
  );
  const openRfqExtraction = rfqExtraction(openRfq?.extractionJson);
  /* People workspace. Every field below exists on the current Account and
     SavedLead records — no new columns or filters were invented. */
  /* Accounts come in two shapes: real rows the lead links to by id, and
     "legacy:" rows the API synthesises for leads captured before an account
     existed. Matching on accountId alone missed every legacy account. */
  const leadInAccount = (lead: SavedLead, accountId: string) =>
    accountId.startsWith('legacy:')
      ? !lead.accountId &&
        'legacy:' + normalizeCompany(lead.company) === accountId
      : lead.accountId === accountId;
  const peopleTerm = peopleQuery.trim().toLowerCase();
  const matchesContact = (lead: SavedLead) =>
    !peopleTerm ||
    [lead.fullName, lead.company, lead.role, lead.email, lead.phone]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(peopleTerm);
  const contactRows = capturedLeads
    .filter((lead) => !accountFilter || leadInAccount(lead, accountFilter))
    .filter(matchesContact)
    .filter((lead) =>
      peopleClass === 'classified'
        ? Boolean(lead.buyingRole)
        : peopleClass === 'unclassified'
          ? !lead.buyingRole
          : true,
    )
    .sort((a, b) =>
      peopleSort === 'az'
        ? a.fullName.localeCompare(b.fullName)
        : peopleSort === 'za'
          ? b.fullName.localeCompare(a.fullName)
          : b.createdAt - a.createdAt,
    );
  const accountRows = accounts
    .filter(
      (account) =>
        !peopleTerm || account.company.toLowerCase().includes(peopleTerm),
    )
    .filter((account) =>
      peopleClass === 'classified'
        ? (account.stakeholders || 0) > 0
        : peopleClass === 'unclassified'
          ? !account.stakeholders
          : true,
    )
    .sort((a, b) =>
      peopleSort === 'az'
        ? a.company.localeCompare(b.company)
        : peopleSort === 'za'
          ? b.company.localeCompare(a.company)
          : peopleSort === 'contacts'
            ? b.contacts - a.contacts
            : b.latestAt - a.latestAt,
    );
  const peopleRows: (SavedLead | Account)[] =
    peopleTab === 'contacts' ? contactRows : accountRows;
  const peoplePageCount = Math.max(
    1,
    Math.ceil(peopleRows.length / PEOPLE_PAGE_SIZE),
  );
  const peopleSafePage = Math.min(peoplePage, peoplePageCount - 1);
  const peopleStart = peopleSafePage * PEOPLE_PAGE_SIZE;
  const pagedContacts = contactRows.slice(
    peopleStart,
    peopleStart + PEOPLE_PAGE_SIZE,
  );
  const pagedAccounts = accountRows.slice(
    peopleStart,
    peopleStart + PEOPLE_PAGE_SIZE,
  );
  const auditPageCount = Math.max(
    1,
    Math.ceil(auditEvents.length / AUDIT_PAGE_SIZE),
  );
  /* The dashboard showed every conversation, which made the home page read
     as the Conversations page. Six is enough to act on; the rest are one
     click away. */
  const scopedLeads = capturedLeads.filter((lead) =>
    leadScope === 'mine'
      ? lead.ownerId === appContext?.user.id
      : leadScope === 'event'
        ? Boolean(activeEventId) && lead.eventId === activeEventId
        : true,
  );
  const dashboardLeads = scopedLeads.slice(0, 6);
  const opportunityCandidates = capturedLeads.filter(
    (lead) =>
      (!activeEventId || lead.eventId === activeEventId) &&
      (!opportunityLead || lead.company === opportunityLead.company),
  );
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
        <div className="workspace-switcher-wrap" ref={workspaceMenuRef}>
          <button
            type="button"
            className="workspace-switcher"
            aria-expanded={workspaceMenuOpen}
            onClick={() => setWorkspaceMenuOpen((value) => !value)}
          >
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
          </button>
          {workspaceMenuOpen ? (
            <div className="workspace-menu">
              {availableWorkspaces.map((workspace) => (
                <button
                  key={workspace.id}
                  type="button"
                  className={
                    workspace.id === appContext?.workspace.id ? 'selected' : ''
                  }
                  onClick={() => {
                    setWorkspaceMenuOpen(false);
                    if (workspace.id !== appContext?.workspace.id)
                      void switchWorkspace(workspace.id);
                  }}
                >
                  <span>
                    <strong>{workspace.name}</strong>
                    <small>
                      {workspace.kind === 'visitor' ? 'Personal' : workspace.plan}
                    </small>
                  </span>
                  {workspace.id === appContext?.workspace.id ? (
                    <Check size={14} />
                  ) : null}
                </button>
              ))}
              <button
                type="button"
                className="workspace-menu-foot"
                onClick={() => {
                  setWorkspaceMenuOpen(false);
                  go('settings');
                }}
              >
                Manage workspaces
              </button>
            </div>
          ) : null}
        </div>
        <nav aria-label="Main navigation">
          {appContext?.workspace.kind === 'visitor' ? (
            <>
              <p className="nav-label">Visitor</p>
              <NavItem
                icon={LayoutDashboard}
                label="Event home"
                active={activeView === 'visitor-home'}
                onClick={() => go('visitor-home')}
              />
              <NavItem
                icon={Search}
                label="Discover"
                active={activeView === 'visitor-discover'}
                onClick={() => go('visitor-discover')}
              />
              <NavItem
                icon={CalendarDays}
                label="My plan"
                active={activeView === 'visitor-plan'}
                onClick={() => go('visitor-plan')}
              />
              <NavItem
                icon={Camera}
                label="Capture"
                active={activeView === 'visitor-capture'}
                onClick={() => go('visitor-capture')}
              />
              <NavItem
                icon={Users}
                label="My contacts"
                active={activeView === 'visitor-contacts'}
                onClick={() => go('visitor-contacts')}
              />
              <NavItem
                icon={Sparkles}
                label="Memory"
                active={activeView === 'visitor-memory'}
                onClick={() => go('visitor-memory')}
              />
              <NavItem
                icon={FileText}
                label="Follow-ups"
                active={activeView === 'visitor-followups'}
                onClick={() => go('visitor-followups')}
              />
              <p className="nav-label nav-label-spaced">Manage</p>
              <NavItem
                icon={Settings}
                label="Workspace settings"
                active={activeView === 'settings'}
                onClick={() => go('settings')}
              />
            </>
          ) : (
            <>
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
            </>
          )}
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
            <span
              className={`live-dot ${activeEvent ? '' : 'idle'}`}
            />{' '}
            {capturableEvents.length ? (
              /* The active event drives every capture, so it should be
                 switchable from the bar that reports it. */
              <select
                className="event-context-switch"
                aria-label="Active event"
                value={activeEventId}
                onChange={(event) => void selectEvent(event.currentTarget.value)}
              >
                {!activeEventId ? (
                  <option value="">No active event</option>
                ) : null}
                {capturableEvents.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            ) : (
              <>{activeEvent?.name || 'No active event'} </>
            )}
            <span>
              ·{' '}
              {activeEvent
                ? `${activeEvent.venue || 'Venue pending'} · ${activeEvent.status}`
                : appContext?.workspace.kind === 'visitor'
                  ? 'Select one in Event home'
                  : 'Select one in Events'}
            </span>
          </div>
          <div className="topbar-actions" ref={topbarActionsRef}>
            <button
              className="search-button"
              aria-label="Search"
              onClick={() => setSearchOpen(true)}
            >
              <Search size={17} />
              <span>Search</span>
              <kbd>Ctrl K</kbd>
            </button>
            <div className="notification-bell">
              <button
                className="icon-button"
                aria-label="Notifications"
                aria-expanded={notificationsOpen}
                onClick={() => {
                  setProfileOpen(false);
                  setNotificationsOpen((value) => !value);
                }}
              >
                <Bell size={19} />
                {operations?.notifications.some((item) => !item.readAt) ? (
                  <span className="notification-dot" />
                ) : null}
              </button>
              {notificationsOpen ? (
                <div className="notification-panel">
                  <div className="notification-panel-head">
                    <strong>Notifications</strong>
                    <button
                      type="button"
                      onClick={() => setNotificationsOpen(false)}
                    >
                      Close
                    </button>
                  </div>
                  {operations?.notifications.length ? (
                    operations.notifications
                      .slice(0, 20)
                      .map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className={`notification-row ${item.readAt ? '' : 'unread'}`}
                          onClick={() =>
                            !item.readAt && markNotificationRead(item.id)
                          }
                        >
                          <strong>{item.title}</strong>
                          <span>{item.body}</span>
                          <small>
                            {dateTime(item.createdAt)}
                          </small>
                        </button>
                      ))
                  ) : (
                    <p className="notification-empty">
                      No notifications yet.
                    </p>
                  )}
                </div>
              ) : null}
            </div>
            <div className="notification-bell">
              <button
                className="icon-button"
                aria-label="Profile"
                aria-expanded={profileOpen}
                onClick={() => {
                  setNotificationsOpen(false);
                  setProfileOpen((value) => !value);
                }}
              >
                <CircleUserRound size={21} />
              </button>
              {profileOpen ? (
                <div className="notification-panel profile-panel">
                  <div className="profile-panel-head">
                    <span className="initial-avatar">
                      {(appContext?.user.email || 'AS').slice(0, 2).toUpperCase()}
                    </span>
                    <span>
                      <strong>
                        {appContext?.user.email || 'Local tester'}
                      </strong>
                      <small>{appContext?.role || 'Loading role'}</small>
                    </span>
                  </div>
                  <button
                    type="button"
                    className="notification-row"
                    onClick={() => {
                      setProfileOpen(false);
                      go('settings');
                    }}
                  >
                    <strong>Workspace settings</strong>
                    <span>Identity, members, plan and data export</span>
                  </button>
                </div>
              ) : null}
            </div>
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
                          {activeEvent && capturableEvents.length > 1 ? (
                            /* Once an event was chosen the name became static
                               text, leaving no way to capture into a different
                               one without leaving the dialog. */
                            <div className="dialog-kicker capture-event-switch">
                              <label htmlFor="capture-event-switch">
                                Capturing into
                              </label>
                              <select
                                id="capture-event-switch"
                                value={activeEventId}
                                onChange={(event) =>
                                  void selectEvent(event.currentTarget.value)
                                }
                              >
                                {capturableEvents.map((item) => (
                                  <option key={item.id} value={item.id}>
                                    {item.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          ) : (
                            <p className="dialog-kicker">
                              {activeEvent?.name || 'Unassigned event'}
                            </p>
                          )}
                          <DialogTitle className="dialog-title">
                            Capture a new conversation
                          </DialogTitle>
                          <DialogDescription>
                            Start with whatever the visitor gives you. Add the
                            conversation immediately after.
                          </DialogDescription>
                        </DialogHeader>
                        {pendingReviewLeads.length ? (
                          <button
                            type="button"
                            className="pending-review-pill"
                            onClick={() => {
                              const lead = pendingReviewLeads[0];
                              resetCapture(false);
                              window.setTimeout(() => openReview(lead), 180);
                            }}
                          >
                            <AlertTriangle size={13} />
                            {pendingReviewLeads.length}{' '}
                            {pendingReviewLeads.length === 1
                              ? 'capture'
                              : 'captures'}{' '}
                            waiting for review
                          </button>
                        ) : null}
                        {!activeEvent ? (
                          <output
                            ref={eventGateRef}
                            className="capture-event-gate"
                          >
                            <span>
                              <CalendarDays size={17} />
                              <strong>Choose the event for this lead</strong>
                            </span>
                            {capturableEvents.length ? (
                              <select
                                aria-label="Event for this lead"
                                defaultValue=""
                                onChange={(event) =>
                                  void selectEvent(event.currentTarget.value)
                                }
                              >
                                <option value="" disabled>
                                  Select an active event
                                </option>
                                {capturableEvents.map((item) => (
                                  <option key={item.id} value={item.id}>
                                    {item.name}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  stashLeadDraft();
                                  setCaptureOpen(false);
                                  setNotice(
                                    'Fill in the event, then run readiness and activate it. Come back here and click Capture lead — your entries will be restored.',
                                  );
                                  setTimeout(() => setNotice(''), 4200);
                                  go('events');
                                  newEvent();
                                }}
                              >
                                Set up and activate an event
                              </button>
                            )}
                            <small>
                              Your scanned fields are kept while you choose.
                            </small>
                          </output>
                        ) : null}
                        <div className="capture-methods">
                          <button
                            type="button"
                            className="scan-button"
                            onClick={() => scanInput.current?.click()}
                          >
                            <Camera />
                            <span>
                              <strong>Scan</strong>
                              <small>
                                Card, badge or QR code — point and capture
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
                            ref={scanInput}
                            className="capture-file-input"
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onInput={selectAttachment}
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
                                  ? 'Demo sample · reading locally on this device'
                                  : 'Original ready · reading locally on this device'}
                              </small>
                            </span>
                          </div>
                        ) : null}
                        {localOcrStatus ? (
                          <p
                            className={`local-ocr-status ${localOcrFields.length ? 'ready' : ''}`}
                            aria-live="polite"
                          >
                            {readingAttachment ? (
                              <span className="local-ocr-spinner" />
                            ) : localOcrFields.length ? (
                              <Check size={15} />
                            ) : (
                              <AlertTriangle size={15} />
                            )}
                            {localOcrStatus}
                          </p>
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
                          {/* Role, event-specific fields, and next-action
                              scheduling are real and saved exactly as typed
                              - they're just not needed to capture the 90% of
                              visitors where a name, company and a note are
                              enough. Open by default only when the event
                              defines its own required fields. */}
                          <details
                            className="more-details"
                            open={
                              moreDetailsOpen ||
                              Boolean(activeEvent?.leadFieldSchema.length)
                            }
                            onToggle={(event) =>
                              setMoreDetailsOpen(
                                (event.target as HTMLDetailsElement).open,
                              )
                            }
                          >
                            <summary>
                              <span>More details</span>
                              <ChevronDown size={14} />
                            </summary>
                            <div className="more-details-body">
                              <div className="field-block">
                                <label htmlFor="lead-role">Role</label>
                                <Input
                                  id="lead-role"
                                  name="role"
                                  placeholder="e.g. Procurement Head"
                                />
                              </div>
                              {activeEvent?.leadFieldSchema.length ? (
                                <div className="field-grid">
                                  {activeEvent.leadFieldSchema.map((label) => (
                                    <div className="field-block" key={label}>
                                      <label htmlFor={`lead-custom-${label}`}>
                                        {label}
                                      </label>
                                      <Input
                                        id={`lead-custom-${label}`}
                                        name={`custom:${label}`}
                                      />
                                    </div>
                                  ))}
                                </div>
                              ) : null}
                              <div className="field-grid">
                                <div className="field-block">
                                  <label htmlFor="lead-action">
                                    Next action
                                  </label>
                                  <Input
                                    id="lead-action"
                                    name="nextAction"
                                    placeholder="e.g. Send preliminary pricing"
                                  />
                                </div>
                                <div className="field-block">
                                  <label htmlFor="lead-due">Due date</label>
                                  <Input
                                    id="lead-due"
                                    name="dueDate"
                                    type="date"
                                  />
                                </div>
                              </div>
                            </div>
                          </details>
                          {saveError ? (
                            <p className="form-error" role="alert">
                              {saveError}
                            </p>
                          ) : null}
                          <Button
                            type="submit"
                            className="save-button"
                            disabled={saving || readingAttachment}
                          >
                            {readingAttachment
                              ? 'Reading card on this device…'
                              : saving
                              ? captureProgress || 'Saving securely…'
                                : !activeEvent
                                ? 'Create or select an event before capture'
                                : localOcrFields.length
                                  ? 'Save reviewed capture'
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
                          {localOcrFields.length
                            ? `${savedLead?.fullName} was saved from on-device OCR`
                            : `${savedLead?.fullName} is ${
                                savedLead?.reviewStatus === 'queued_offline'
                                  ? 'waiting to sync'
                                  : 'ready for review'
                              }`}
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
                                : localOcrFields.length
                                  ? 'OCR reviewed'
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
                        <Button className="save-button scan-next-button" onClick={scanNext}>
                          <Camera size={16} /> Scan next
                        </Button>
                        <div className="success-actions-secondary">
                          {savedLead?.note &&
                          savedLead.reviewStatus !== 'queued_offline' ? (
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => prepareFollowup(savedLead)}
                            >
                              Prepare follow-up
                            </Button>
                          ) : null}
                          {captureOutcome && savedLead && !localOcrFields.length ? (
                            <Button
                              type="button"
                              variant="outline"
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
                            type="button"
                            variant="outline"
                            onClick={() => resetCapture(false)}
                          >
                            Back to today
                          </Button>
                        </div>
                      </div>
                    )}
                  </DialogContent>
                </Dialog>
                <Dialog
                  open={
                    Boolean(reviewLead) &&
                    appContext?.workspace.kind !== 'visitor'
                  }
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
                          : `Review ${reviewLead?.fullName ?? 'contact'}`}
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
                    {reviewLead ? (
                      <div className="review-context-actions">
                        <button
                          type="button"
                          className={reviewRecording ? 'recording' : ''}
                          onClick={toggleReviewRecording}
                          disabled={Boolean(attachingReviewAsset)}
                        >
                          {reviewRecording ? (
                            <Square size={14} />
                          ) : (
                            <Mic size={14} />
                          )}
                          {reviewRecording
                            ? 'Stop recording'
                            : attachingReviewAsset === 'audio'
                              ? 'Reading audio note…'
                              : 'Add audio note'}
                        </button>
                        <button
                          type="button"
                          onClick={() => reviewDocInput.current?.click()}
                          disabled={
                            Boolean(attachingReviewAsset) || reviewRecording
                          }
                        >
                          <FileText size={14} />
                          {attachingReviewAsset === 'document'
                            ? 'Attaching…'
                            : 'Attach brochure'}
                        </button>
                        <input
                          ref={reviewDocInput}
                          className="capture-file-input"
                          type="file"
                          accept="image/*,.pdf"
                          onInput={selectReviewDocument}
                        />
                      </div>
                    ) : null}
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
                          Machine-read suggestions
                          {/* On-device OCR reports no score, and rendering it
                              as "0% confidence" reads as a failed extraction. */}
                          {reviewCaptureExtraction.confidence > 0
                            ? ` · ${Math.round(reviewCaptureExtraction.confidence * 100)}% overall confidence`
                            : ''}
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
                        {events.find((item) => item.id === reviewLead.eventId)
                          ?.leadFieldSchema.length ? (
                          <div className="field-grid">
                            {events
                              .find((item) => item.id === reviewLead.eventId)
                              ?.leadFieldSchema.map((label) => (
                                <div className="field-block" key={label}>
                                  <label
                                    htmlFor={`review-custom-${label}`}
                                  >
                                    {label}
                                  </label>
                                  <input
                                    className="review-input"
                                    id={`review-custom-${label}`}
                                    name={`custom:${label}`}
                                    defaultValue={
                                      reviewLead.customFields?.[label] || ''
                                    }
                                  />
                                </div>
                              ))}
                          </div>
                        ) : null}
                        <Button type="submit" variant="outline">
                          {reviewLead.captureStatus ===
                          'completed_pending_review'
                            ? 'Confirm review and save'
                            : 'Save verified details'}
                        </Button>
                        <div className="field-grid">
                          <div className="consent-cell">
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
                          <div className="consent-cell">
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
                          <Input name="reason" placeholder="Assignment reason" />
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
                          onClick={() => analyzeConversation()}
                          disabled={analyzing || !reviewLead?.note}
                        >
                          {analyzing
                            ? 'Analyzing evidence…'
                            : 'Analyze conversation'}{' '}
                          <Sparkles />
                        </Button>
                        {!reviewLead?.note && !analyzing ? (
                          <p className="field-help">
                            Add a conversation note to this contact first —
                            there is nothing to analyse yet.
                          </p>
                        ) : null}
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
                                To {draft.recipient} ·{' '}
                                {draft.status === 'handed_off'
                                  ? 'Handed off'
                                  : draft.status === 'approved'
                                    ? 'Approved'
                                    : 'Draft'}{' '}
                                · v{draft.version}
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
                                ) : draft.status === 'handed_off' ? (
                                  <span className="handoff-note">
                                    <Check size={13} /> Handed off
                                    {draft.handedOffAt
                                      ? ` · ${dateTime(draft.handedOffAt)}`
                                      : ''}{' '}
                                    — not confirmed sent
                                  </span>
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
                                  ) : draft.status === 'handed_off' ? (
                                    <>
                                      <Check /> Handed off
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
                    {reviewLead ? (
                      <section className="comment-section">
                        <h3>Team notes</h3>
                        <p className="field-help">
                          Visible to everyone with access to this event.
                          Mention a colleague to notify them.
                        </p>
                        <div className="comment-list">
                          {leadComments.length ? (
                            leadComments.map((comment) => (
                              <article className="comment-row" key={comment.id}>
                                <span className="initial-avatar small">
                                  {comment.authorName
                                    .split(' ')
                                    .map((word) => word[0])
                                    .join('')
                                    .slice(0, 2)
                                    .toUpperCase()}
                                </span>
                                <span>
                                  <strong>
                                    {comment.authorName}{' '}
                                    <small>
                                      {dateTime(comment.createdAt,
                                      )}
                                    </small>
                                  </strong>
                                  <p>{comment.body}</p>
                                </span>
                              </article>
                            ))
                          ) : (
                            <p className="field-help">
                              No comments yet. Start the thread below.
                            </p>
                          )}
                        </div>
                        <form className="comment-form" onSubmit={postComment}>
                          <Textarea
                            name="body"
                            placeholder="Add a note for the team…"
                            required
                          />
                          {members.filter(
                            (member) =>
                              member.status === 'active' &&
                              member.userId !== appContext?.user.id,
                          ).length ? (
                            <div className="mention-picker">
                              <span>Mention:</span>
                              {members
                                .filter(
                                  (member) =>
                                    member.status === 'active' &&
                                    member.userId !== appContext?.user.id,
                                )
                                .map((member) => (
                                  <label key={member.id}>
                                    <input
                                      type="checkbox"
                                      checked={commentMentions.includes(
                                        member.userId,
                                      )}
                                      onChange={(event) =>
                                        setCommentMentions((current) =>
                                          event.currentTarget.checked
                                            ? [...current, member.userId]
                                            : current.filter(
                                                (id) => id !== member.userId,
                                              ),
                                        )
                                      }
                                    />
                                    {member.displayName ||
                                      member.email ||
                                      'Member'}
                                  </label>
                                ))}
                            </div>
                          ) : null}
                          <Button
                            type="submit"
                            variant="outline"
                            disabled={postingComment}
                          >
                            {postingComment ? 'Posting…' : 'Post comment'}
                          </Button>
                        </form>
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
                              title={`Priority score ${action.priority}`}
                            >
                              {action.priority >= 94
                                ? 'Urgent'
                                : action.priority >= 70
                                  ? 'High'
                                  : 'Normal'}
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
                                    ? ` · ${reminderDue ? 'Reminder due' : `Reminder ${dateTime(task.reminderAt)}`}`
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
                  <div className="panel-head-actions">
                    <select
                      className="scope-select"
                      aria-label="Filter conversations"
                      value={leadScope}
                      onChange={(event) =>
                        setLeadScope(event.currentTarget.value)
                      }
                    >
                      <option value="all">All leads</option>
                      <option value="mine">My leads</option>
                      <option value="event">This event</option>
                    </select>
                    <button onClick={() => go('people')}>
                      View all conversations <ArrowRight />
                    </button>
                  </div>
                </div>
                <div className="lead-table" aria-label="Recent conversations">
                  <div className="lead-row lead-header">
                    <span>Person</span>
                    <span>Interest</span>
                    <span>AI score</span>
                    <span>Captured</span>
                  </div>
                  {dashboardLeads.map((lead) => (
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
                  {!dashboardLeads.length ? (
                    <div className="empty-state">
                      {!capturedLeads.length
                        ? 'No conversations captured in this workspace yet.'
                        : leadScope === 'event'
                          ? `No conversations captured against ${activeEvent?.name || 'this event'} yet.`
                          : 'No conversations assigned to you yet.'}
                    </div>
                  ) : null}
                </div>
              </section>
            </>
          ) : (
            <section className="section-view">
              <div className="section-title">
                <div>
                  <p className="eyebrow">
                    {appContext?.workspace.kind === 'visitor'
                      ? 'Personal workspace'
                      : 'Revenue workspace'}
                  </p>
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
                                  : activeView === 'knowledge'
                                    ? 'Company knowledge'
                                    : activeView === 'visitor-home'
                                      ? 'Event home'
                                      : activeView === 'visitor-discover'
                                        ? 'Discover'
                                        : activeView === 'visitor-plan'
                                          ? 'My plan'
                                          : activeView === 'visitor-capture'
                                            ? 'Capture'
                                            : activeView ===
                                                'visitor-contacts'
                                              ? 'My contacts'
                                              : activeView ===
                                                  'visitor-memory'
                                                ? 'Memory'
                                                : activeView ===
                                                    'visitor-followups'
                                                  ? 'Follow-ups'
                                                  : ''}
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
                <section className="people-workspace">
                  <nav className="entity-tabs" aria-label="People and accounts">
                    <button
                      type="button"
                      className={peopleTab === 'accounts' ? 'current' : ''}
                      aria-current={peopleTab === 'accounts' ? 'page' : undefined}
                      onClick={() => {
                        setPeopleTab('accounts');
                        setPeoplePage(0);
                      }}
                    >
                      Accounts <b>{accounts.length}</b>
                    </button>
                    <button
                      type="button"
                      className={peopleTab === 'contacts' ? 'current' : ''}
                      aria-current={peopleTab === 'contacts' ? 'page' : undefined}
                      onClick={() => {
                        setPeopleTab('contacts');
                        setPeoplePage(0);
                      }}
                    >
                      Contacts <b>{capturedLeads.length}</b>
                    </button>
                  </nav>

                  <div className="entity-toolbar">
                    <label className="entity-search">
                      <Search size={15} />
                      <input
                        value={peopleQuery}
                        onChange={(event) => {
                          setPeopleQuery(event.currentTarget.value);
                          setPeoplePage(0);
                        }}
                        placeholder={
                          peopleTab === 'contacts'
                            ? 'Search contacts…'
                            : 'Search accounts…'
                        }
                        aria-label={
                          peopleTab === 'contacts'
                            ? 'Search contacts'
                            : 'Search accounts'
                        }
                      />
                    </label>
                    <div className="entity-toolbar-actions">
                      <select
                        aria-label="Filter by classification"
                        value={peopleClass}
                        onChange={(event) => {
                          setPeopleClass(event.currentTarget.value);
                          setPeoplePage(0);
                        }}
                      >
                        <option value="all">All classifications</option>
                        <option value="classified">Classified</option>
                        <option value="unclassified">Unclassified</option>
                      </select>
                      <select
                        aria-label="Sort"
                        value={peopleSort}
                        onChange={(event) =>
                          setPeopleSort(event.currentTarget.value)
                        }
                      >
                        <option value="recent">
                          {peopleTab === 'contacts'
                            ? 'Recently added'
                            : 'Recent activity'}
                        </option>
                        <option value="az">Name A–Z</option>
                        <option value="za">Name Z–A</option>
                        {peopleTab === 'accounts' ? (
                          <option value="contacts">Most contacts</option>
                        ) : null}
                      </select>
                      <Button
                        type="button"
                        className="capture-button"
                        onClick={() => setCaptureOpen(true)}
                      >
                        <Plus /> Add contact
                      </Button>
                    </div>
                  </div>

                  {accountFilter && peopleTab === 'contacts' ? (
                    <div className="entity-filter-note">
                      <button
                        type="button"
                        className="filter-pill"
                        onClick={() => setAccountFilter('')}
                      >
                        {filteredAccount?.company || 'Filtered'}
                        <X size={13} />
                      </button>
                    </div>
                  ) : null}

                  <div className="entity-table">
                    {peopleTab === 'contacts' ? (
                      <>
                        <div className="entity-head contact-grid" aria-hidden="true">
                          <span>Name</span>
                          <span>Company</span>
                          <span>Role</span>
                          <span>Status</span>
                        </div>
                        {pagedContacts.map((lead) => (
                          <button
                            type="button"
                            className="entity-row contact-grid"
                            key={lead.id}
                            onClick={() => openReview(lead)}
                          >
                            <span className="entity-primary">
                              <span className="initial-avatar small">
                                {lead.fullName
                                    .split(' ')
                                    .map((word) => word[0])
                                    .join('')
                                    .slice(0, 2)}
                              </span>
                              <span>{lead.fullName}</span>
                            </span>
                            <span data-label="Company">{lead.company}</span>
                            <span data-label="Role">{lead.role || '—'}</span>
                            <span data-label="Status">
                              {lead.buyingRole ? (
                                <b className="review-chip">
                                  {lead.buyingRole.replaceAll('_', ' ')}
                                </b>
                              ) : (
                                <span className="classify-link">
                                  Classify <ArrowRight size={12} />
                                </span>
                              )}
                            </span>
                          </button>
                        ))}
                        {!pagedContacts.length ? (
                          <div className="entity-empty">
                            <strong>No contacts found</strong>
                            <p>
                              {capturedLeads.length
                                ? 'Try changing your search or filters.'
                                : 'Capture a conversation to add your first contact.'}
                            </p>
                            {!capturedLeads.length ? (
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => setCaptureOpen(true)}
                              >
                                Add contact
                              </Button>
                            ) : null}
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <>
                        <div className="entity-head account-grid" aria-hidden="true">
                          <span>Account</span>
                          <span>Contacts</span>
                          <span>Classified</span>
                          <span>Last activity</span>
                        </div>
                        {pagedAccounts.map((account) => (
                          <button
                            type="button"
                            className="entity-row account-grid"
                            key={account.id}
                            onClick={() => {
                              setAccountFilter(account.id);
                              setPeopleTab('contacts');
                              setPeoplePage(0);
                            }}
                          >
                            <span className="entity-primary">
                              <span className="initial-avatar small">
                                {account.company
                                    .split(' ')
                                    .map((word) => word[0])
                                    .join('')
                                    .slice(0, 2)}
                              </span>
                              <span>{account.company}</span>
                            </span>
                            <span data-label="Contacts" className="entity-num">
                              {account.contacts}
                            </span>
                            <span data-label="Classified" className="entity-num">
                              {account.stakeholders || 0}
                            </span>
                            <span data-label="Last activity">
                              {account.latestAt
                                ? dateTime(account.latestAt)
                                : '—'}
                            </span>
                          </button>
                        ))}
                        {!pagedAccounts.length ? (
                          <div className="entity-empty">
                            <strong>No accounts found</strong>
                            <p>
                              {accounts.length
                                ? 'Try changing your search or filters.'
                                : 'Capture a lead to create the first account.'}
                            </p>
                          </div>
                        ) : null}
                      </>
                    )}
                  </div>

                  {peopleRows.length ? (
                    <div className="entity-footer">
                      <small>
                        Showing {peopleStart + 1}–
                        {Math.min(
                          peopleStart + PEOPLE_PAGE_SIZE,
                          peopleRows.length,
                        )}{' '}
                        of {peopleRows.length}
                      </small>
                      {peoplePageCount > 1 ? (
                        <nav className="pager" aria-label="Pages">
                          <button
                            type="button"
                            disabled={peopleSafePage === 0}
                            onClick={() => setPeoplePage((p) => p - 1)}
                          >
                            Previous
                          </button>
                          <span className="pager-pages">
                            {Array.from({ length: peoplePageCount }).map(
                              (_, index) => (
                                <button
                                  key={index}
                                  type="button"
                                  className={
                                    index === peopleSafePage ? 'current' : ''
                                  }
                                  onClick={() => setPeoplePage(index)}
                                >
                                  {index + 1}
                                </button>
                              ),
                            )}
                          </span>
                          <button
                            type="button"
                            disabled={peopleSafePage >= peoplePageCount - 1}
                            onClick={() => setPeoplePage((p) => p + 1)}
                          >
                            Next
                          </button>
                        </nav>
                      ) : null}
                    </div>
                  ) : null}
                </section>
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
                              {(() => {
                                const candidates = capturedLeads.filter(
                                  (lead) =>
                                    lead.company === item.company &&
                                    !item.contacts.some(
                                      (contact) => contact.leadId === lead.id,
                                    ),
                                );
                                /* The picker used to render with nothing but
                                   its placeholder, so it looked actionable and
                                   did nothing. Say why instead. */
                                if (!candidates.length)
                                  return (
                                    <span className="stakeholder-empty">
                                      No other {item.company} contacts captured
                                      yet
                                    </span>
                                  );
                                return (
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
                                    {candidates.map((lead) => (
                                      <option key={lead.id} value={lead.id}>
                                        {lead.fullName} ·{' '}
                                        {lead.buyingRole ||
                                          lead.role ||
                                          'Contact'}
                                      </option>
                                    ))}
                                  </select>
                                );
                              })()}
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
                <Dialog
                  open={quotationDialogOpen}
                  onOpenChange={setQuotationDialogOpen}
                >
                  <DialogContent className="capture-dialog">
                  <div className="settings-heading">
                    <FileText />
                    <div>
                      <DialogTitle>Create a quotation</DialogTitle>
                      <DialogDescription>
                        Issue the commercial document and track it through
                        customer acceptance.
                      </DialogDescription>
                    </div>
                  </div>
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
                        <select
                          id="quote-rfq"
                          name="rfqId"
                          defaultValue={openRfqId}
                        >
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
                  </DialogContent>
                </Dialog>
              ) : null}
              {activeView === 'rfqs' && !openRfqId ? (
                <div className="rfq-layout">
                  <Dialog
                    open={rfqDialogOpen}
                    onOpenChange={setRfqDialogOpen}
                  >
                    <DialogContent className="capture-dialog">
                    <div className="settings-heading">
                      <FileText />
                      <div>
                        <DialogTitle>Receive an RFQ</DialogTitle>
                        <DialogDescription>
                          Store the original document and create accountable
                          response deadlines.
                        </DialogDescription>
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
                    </DialogContent>
                  </Dialog>
                  <section className="rfq-list">
                    <div className="event-list-heading">
                      <div>
                        <h2>RFQ pipeline</h2>
                        <p>Earliest submission deadlines appear first.</p>
                      </div>
                      <div className="event-list-heading-actions">
                        <b>{rfqs.length} total</b>
                        <Button
                          type="button"
                          className="capture-button"
                          onClick={() => setRfqDialogOpen(true)}
                        >
                          <Plus /> Receive an RFQ
                        </Button>
                      </div>
                    </div>
                    {rfqs.length ? (
                      rfqs.map((item) => (
                        <article className="panel rfq-record" key={item.id}>
                          <button
                            type="button"
                            className="rfq-record-open"
                            onClick={() => setOpenRfqId(item.id)}
                          >
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
                          </button>
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
                                  ? dateTime(item.ownerDueAt)
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
              {activeView === 'rfqs' && !openRfqId ? (
                <section className="quotation-section">
                  <div className="event-list-heading">
                    <div>
                      <h2>Quotations</h2>
                      <p>
                        Track the commercial document from draft through
                        customer acceptance.
                      </p>
                    </div>
                    <div className="event-list-heading-actions">
                      <b>{quotations.length} total</b>
                      <Button
                        type="button"
                        className="capture-button"
                        onClick={() => setQuotationDialogOpen(true)}
                      >
                        <Plus /> New quotation
                      </Button>
                    </div>
                  </div>
                  <div className="quotation-layout">
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
              !openRfqId &&
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
                              <b
                                className={`event-status ${item.extractionStatus === 'completed' ? 'active' : ''}`}
                              >
                                {item.extractionStatus?.replaceAll('_', ' ') ||
                                  'not processed'}
                              </b>
                            </div>
                            {renderRfqExtraction(item, extracted)}
                          </article>
                        );
                      })}
                  </div>
                </section>
              ) : null}
              {activeView === 'rfqs' && openRfqId ? (
                <section className="rfq-detail">
                  <button
                    type="button"
                    className="detail-back"
                    onClick={() => setOpenRfqId('')}
                  >
                    <ArrowLeft size={14} /> RFQs &amp; quotations
                  </button>
                  {!openRfq && rfqState === 'error' ? (
                    <article className="panel empty-state large">
                      <AlertTriangle />
                      <h2>Could not load this RFQ</h2>
                      <p>The request to the workspace failed.</p>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => void loadRfqs()}
                      >
                        Retry
                      </Button>
                    </article>
                  ) : !openRfq && rfqState === 'ready' ? (
                    <article className="panel empty-state large">
                      <FileText />
                      <h2>RFQ not found</h2>
                      <p>
                        It no longer exists, or it belongs to an event you
                        cannot access.
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setOpenRfqId('')}
                      >
                        Back to RFQs
                      </Button>
                    </article>
                  ) : !openRfq ? (
                    <article className="panel empty-state large">
                      <p>Loading RFQ…</p>
                    </article>
                  ) : (
                    <>
                      <header className="rfq-detail-head">
                        <div>
                          <h2>{openRfq.title}</h2>
                          <p>
                            {openRfq.requesterCompany}
                            {openRfq.reference
                              ? ` · ${openRfq.reference}`
                              : ''}
                          </p>
                        </div>
                        <div className="rfq-detail-status">
                          {/* One control, not a badge beside a duplicate of
                              itself: the select shows the status and changes
                              it. Read-only members get the badge instead. */}
                          {canManageRfq ? (
                            <select
                              aria-label="RFQ status"
                              value={openRfq.status}
                              onChange={(event) =>
                                updateRfqStatus(openRfq, event.target.value)
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
                          ) : (
                            <b className="stage-chip">
                              {openRfq.status.replaceAll('_', ' ')}
                            </b>
                          )}
                        </div>
                      </header>
                      {openRfq.clarificationNote ? (
                        <p className="rfq-detail-flag">
                          Clarification: {openRfq.clarificationNote}
                        </p>
                      ) : null}
                      <div className="rfq-detail-grid">
                        <span>
                          <small>Customer deadline</small>
                          <strong>
                            {openRfq.submissionDeadline || 'Not set'}
                          </strong>
                        </span>
                        <span>
                          <small>Owner</small>
                          <strong>
                            {openRfq.ownerName || openRfq.ownerId}
                          </strong>
                        </span>
                        <span>
                          <small>Owner SLA</small>
                          <strong>
                            {openRfq.ownerDueAt
                              ? dateTime(openRfq.ownerDueAt)
                              : 'Not set'}
                          </strong>
                        </span>
                        <span>
                          <small>Received</small>
                          <strong>{dateTime(openRfq.createdAt)}</strong>
                        </span>
                        <span>
                          <small>Contact</small>
                          <strong>
                            {openRfq.contactName || 'Not recorded'}
                          </strong>
                        </span>
                        <span>
                          <small>Delivery location</small>
                          <strong>
                            {openRfq.deliveryLocation || 'Not recorded'}
                          </strong>
                        </span>
                      </div>
                      <div className="rfq-detail-panels">
                        <article className="panel rfq-detail-panel">
                          <div className="rfq-detail-panel-head">
                            <h3>Requirements</h3>
                            <b>
                              {openRfq.itemCount}{' '}
                              {openRfq.itemCount === 1 ? 'item' : 'items'}
                            </b>
                          </div>
                          <p className="rfq-detail-note">
                            {openRfq.documentCount
                              ? `Original stored securely · ${openRfq.documentCount} file${openRfq.documentCount === 1 ? '' : 's'}`
                              : 'Manual structured intake · no original document attached'}
                          </p>
                          {openRfq.documentCount ? (
                            <>
                              <p className="rfq-detail-note">
                                Extraction:{' '}
                                {openRfq.extractionStatus?.replaceAll(
                                  '_',
                                  ' ',
                                ) || 'not processed'}
                              </p>
                              {canManageRfq
                                ? renderRfqExtraction(
                                    openRfq,
                                    openRfqExtraction,
                                  )
                                : null}
                            </>
                          ) : null}
                        </article>
                        <article className="panel rfq-detail-panel">
                          <div className="rfq-detail-panel-head">
                            <h3>Submissions</h3>
                            <b>{openRfq.submissionCount || 0} recorded</b>
                          </div>
                          <p className="rfq-detail-note">
                            {openRfq.latestSubmissionNote
                              ? `Latest: ${openRfq.latestSubmissionNote}`
                              : 'No submissions recorded.'}
                          </p>
                          {canManageRfq &&
                          ['ready_to_quote', 'quoted'].includes(
                            openRfq.status,
                          ) ? (
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => recordRfqSubmission(openRfq)}
                            >
                              <Plus /> Record submission
                            </Button>
                          ) : null}
                        </article>
                        <article className="panel rfq-detail-panel">
                          <div className="rfq-detail-panel-head">
                            <h3>Quotations</h3>
                            <b>{openRfqQuotations.length} linked</b>
                          </div>
                          {openRfqQuotations.length ? (
                            <ul className="rfq-quote-list">
                              {openRfqQuotations.map((quote) => (
                                <li key={quote.id}>
                                  <span>
                                    <strong>{quote.quoteNumber}</strong>
                                    <small>
                                      {quote.customer} · v{quote.version}
                                    </small>
                                  </span>
                                  <span className="rfq-quote-amount">
                                    {money(quote.amount, quote.currency)}
                                  </span>
                                  <b className="stage-chip">
                                    {quote.status.replaceAll('_', ' ')}
                                  </b>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="rfq-detail-note">
                              No quotations yet.
                            </p>
                          )}
                          {canManageRfq ? (
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => setQuotationDialogOpen(true)}
                            >
                              <Plus /> Create quotation
                            </Button>
                          ) : null}
                        </article>
                      </div>
                    </>
                  )}
                </section>
              ) : null}
              {activeView === 'meetings' ? (
                <div className="meetings-layout">
                  <Dialog
                    open={meetingDialogOpen}
                    onOpenChange={setMeetingDialogOpen}
                  >
                    <DialogContent className="capture-dialog">
                    <div className="settings-heading">
                      <CalendarDays />
                      <div>
                        <DialogTitle>Schedule a meeting</DialogTitle>
                        <DialogDescription>
                          Create an accountable calendar record without sending
                          anything automatically.
                        </DialogDescription>
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
                    </DialogContent>
                  </Dialog>
                  <section className="meeting-list">
                    <div className="event-list-heading">
                      <div>
                        <h2>Meeting schedule</h2>
                        <p>
                          Calendar files are generated on demand; the system
                          does not claim an invitation was delivered.
                        </p>
                      </div>
                      <div className="event-list-heading-actions">
                        <b>{meetings.length} total</b>
                        <Button
                          type="button"
                          className="capture-button"
                          onClick={() => setMeetingDialogOpen(true)}
                        >
                          <Plus /> Schedule meeting
                        </Button>
                      </div>
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
                                {dateTime(meeting.startsAt)}
                              </strong>
                            </span>
                            <span>
                              <small>Ends</small>
                              <strong>
                                {dateTime(meeting.endsAt)}
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
                <div className="events-layout events-layout-single">
                  {!activeEvent ? (
                    <div className="event-onboarding-hint">
                      <CalendarDays size={17} />
                      <div>
                        <strong>No event is active yet</strong>
                        <p>
                          Leads can&apos;t be captured until one event is
                          activated and selected. 1) Click{' '}
                          <b>New event</b> below and fill in the details.
                          2) On the created event, click{' '}
                          <b>Run readiness</b>. 3) Once checks pass, click{' '}
                          <b>Activate for capture</b>, then{' '}
                          <b>Use for capture</b>. 4) Go back to Today and
                          click Capture lead again — anything you&apos;d
                          already typed there is restored automatically.
                        </p>
                      </div>
                    </div>
                  ) : null}
                  <Dialog open={eventDialogOpen} onOpenChange={closeEventDialog}>
                    <DialogContent className="capture-dialog">
                    <div className="settings-heading">
                      <CalendarDays />
                      <div>
                        <DialogTitle>
                          {editingEventId ? 'Edit event' : 'Prepare an event'}
                        </DialogTitle>
                        <DialogDescription>
                          Configure the booth goal, qualification playbook,
                          routing and follow-up standard before the team
                          arrives.
                        </DialogDescription>
                      </div>
                    </div>
                    <form
                      className="lead-form"
                      key={appContext?.workspace.id || 'event-loading'}
                      ref={eventForm}
                      onSubmit={submitEvent}
                    >
                      {editingEventId ? (
                        <output className="editing-banner">
                          Editing an existing event. Saving will reassess
                          readiness and move it back to draft.{' '}
                          <button type="button" onClick={cancelEditEvent}>
                            Cancel edit
                          </button>
                        </output>
                      ) : null}
                      <div className="field-grid">
                        <div className="field-block">
                          <label htmlFor="event-name">Event name</label>
                          <Input
                            id="event-name"
                            name="name"
                            required
                            placeholder="IndustrialTech Expo 2027"
                            onChange={(event) =>
                              checkSimilarEvents(event.currentTarget.value)
                            }
                          />
                          {similarEventMatches.length ? (
                            <div className="similar-event-hint">
                              <AlertTriangle size={13} />
                              <span>
                                {similarEventMatches.length === 1
                                  ? 'An event with a similar name already exists: '
                                  : 'Events with similar names already exist: '}
                                {similarEventMatches.map((match, index) => (
                                  <span key={match.id}>
                                    {index > 0 ? ', ' : ''}
                                    <button
                                      type="button"
                                      onClick={() => editEvent(match)}
                                    >
                                      {match.name} ({match.status})
                                    </button>
                                  </span>
                                ))}
                                . Configure one of these instead of creating a
                                duplicate, if it&apos;s the same event.
                              </span>
                            </div>
                          ) : null}
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
                      {/* Only 4 fields have to be typed to create a draft
                          event - everything below either has a working
                          default or is genuinely optional at creation time.
                          The readiness checklist already names exactly what's
                          still missing (Venue and booth, Event objective,
                          Event offerings, ...) with a working link back here,
                          so hiding them costs nothing and the wall of 14
                          fields doesn't have to be read to create something.
                          Editing an existing event opens it by default - nothing
                          already configured should look like it went missing. */}
                      <details
                        className="more-details"
                        open={Boolean(editingEventId)}
                      >
                        <summary>
                          <span>More details</span>
                          <ChevronDown size={14} />
                        </summary>
                        <div className="more-details-body">
                          <div className="event-three">
                            <div className="field-block">
                              <label htmlFor="event-hall">Hall</label>
                              <Input
                                id="event-hall"
                                name="hall"
                                placeholder="2"
                              />
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
                                  appContext?.workspace.timezone ||
                                  'Asia/Kolkata'
                                }
                                required
                              />
                            </div>
                          </div>
                          <h3 className="form-group-label">Playbook</h3>
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
                              <label htmlFor="event-targets">
                                Target accounts
                              </label>
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
                          <div className="field-block">
                            <label htmlFor="event-lead-fields">
                              Custom lead fields
                            </label>
                            <Textarea
                              id="event-lead-fields"
                              name="leadFieldSchema"
                              placeholder="Budget, Timeline, Machine count (comma separated)"
                            />
                            <small className="field-help">
                              Each label becomes an extra field on this
                              event&apos;s capture form.
                            </small>
                          </div>
                          <h3 className="form-group-label">Commercial</h3>
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
                          <h3 className="form-group-label">
                            Routing and follow-up
                          </h3>
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
                                <option value="round_robin">
                                  Round robin
                                </option>
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
                                  <option
                                    key={member.id}
                                    value={member.userId}
                                  >
                                    {member.displayName ||
                                      member.email ||
                                      'Team member'}{' '}
                                    · {member.role}
                                  </option>
                                ))}
                            </select>
                            <small className="field-help">
                              Hold Ctrl or Command to select more than one
                              person. The creator is assigned automatically;
                              owners and admins retain workspace oversight.
                            </small>
                          </div>
                        </div>
                      </details>
                      <Button
                        className="save-button"
                        type="submit"
                        disabled={
                          !['owner', 'admin', 'manager'].includes(
                            appContext?.role || '',
                          )
                        }
                      >
                        {editingEventId
                          ? 'Save event changes'
                          : 'Create event workspace'}
                      </Button>
                    </form>
                    </DialogContent>
                  </Dialog>
                  <Dialog
                    open={Boolean(quickFixTarget)}
                    onOpenChange={closeEventQuickFix}
                  >
                    <DialogContent className="capture-dialog">
                      {quickFixTarget ? (
                        <>
                          <div className="settings-heading">
                            <CalendarDays />
                            <div>
                              <DialogTitle>
                                Fix: {quickFixTarget.label}
                              </DialogTitle>
                              <DialogDescription>
                                {quickFixTarget.detail} Only this saves —
                                everything else about {quickFixTarget.item.name}{' '}
                                stays exactly as it is.
                              </DialogDescription>
                            </div>
                          </div>
                          <form
                            className="lead-form"
                            key={quickFixTarget.item.id + quickFixTarget.checkKey}
                            onSubmit={submitEvent}
                          >
                            {quickFixTarget.checkKey === 'event_location' ? (
                              <div className="field-grid">
                                <div className="field-block">
                                  <label htmlFor="quickfix-venue">
                                    Venue
                                  </label>
                                  <Input
                                    id="quickfix-venue"
                                    name="venue"
                                    required
                                    defaultValue={
                                      quickFixTarget.item.venue || ''
                                    }
                                    placeholder="Bombay Exhibition Centre"
                                  />
                                </div>
                                <div className="field-block">
                                  <label htmlFor="quickfix-booth">
                                    Booth
                                  </label>
                                  <Input
                                    id="quickfix-booth"
                                    name="booth"
                                    required
                                    defaultValue={
                                      quickFixTarget.item.booth || ''
                                    }
                                    placeholder="B-18"
                                  />
                                </div>
                              </div>
                            ) : null}
                            {quickFixTarget.checkKey === 'event_objective' ? (
                              <div className="field-block">
                                <label htmlFor="quickfix-objective">
                                  Business objective
                                </label>
                                <Textarea
                                  id="quickfix-objective"
                                  name="objective"
                                  required
                                  defaultValue={
                                    quickFixTarget.item.objective || ''
                                  }
                                  placeholder="Book 30 qualified demos and create a measurable sales pipeline."
                                />
                              </div>
                            ) : null}
                            {quickFixTarget.checkKey === 'event_products' ? (
                              <div className="field-block">
                                <label htmlFor="quickfix-products">
                                  Products or services
                                </label>
                                <Input
                                  id="quickfix-products"
                                  name="products"
                                  required
                                  defaultValue={quickFixTarget.item.products.join(
                                    ', ',
                                  )}
                                  placeholder="MachineSight, Integration assessment"
                                />
                              </div>
                            ) : null}
                            {quickFixTarget.checkKey ===
                            'qualification_questions' ? (
                              <div className="field-block">
                                <label htmlFor="quickfix-questions">
                                  Qualification questions
                                </label>
                                <Textarea
                                  id="quickfix-questions"
                                  name="qualificationQuestions"
                                  required
                                  defaultValue={quickFixTarget.item.qualificationQuestions.join(
                                    ', ',
                                  )}
                                  placeholder="How many machines?, Which ERP?, When does budget open? (comma separated)"
                                />
                              </div>
                            ) : null}
                            {quickFixTarget.checkKey === 'assigned_team' ? (
                              <div className="field-block">
                                <label htmlFor="quickfix-team">
                                  Assigned team members
                                </label>
                                <select
                                  id="quickfix-team"
                                  name="teamMemberIds"
                                  multiple
                                  required
                                  defaultValue={quickFixTarget.item.teamMemberIds}
                                  size={Math.min(4, Math.max(2, members.length))}
                                >
                                  {members
                                    .filter(
                                      (member) => member.status === 'active',
                                    )
                                    .map((member) => (
                                      <option
                                        key={member.id}
                                        value={member.userId}
                                      >
                                        {member.displayName ||
                                          member.email ||
                                          'Team member'}{' '}
                                        · {member.role}
                                      </option>
                                    ))}
                                </select>
                                <small className="field-help">
                                  Hold Ctrl or Command to select more than one
                                  person.
                                </small>
                              </div>
                            ) : null}
                            {/* Carry forward every other field unedited so
                                the backend's full-row update can't drop
                                anything this dialog doesn't show. */}
                            <input
                              type="hidden"
                              name="name"
                              value={quickFixTarget.item.name}
                            />
                            {quickFixTarget.checkKey !== 'event_location' ? (
                              <>
                                <input
                                  type="hidden"
                                  name="venue"
                                  value={quickFixTarget.item.venue || ''}
                                />
                                <input
                                  type="hidden"
                                  name="booth"
                                  value={quickFixTarget.item.booth || ''}
                                />
                              </>
                            ) : null}
                            <input
                              type="hidden"
                              name="hall"
                              value={quickFixTarget.item.hall || ''}
                            />
                            <input
                              type="hidden"
                              name="startsOn"
                              value={quickFixTarget.item.startsOn}
                            />
                            <input
                              type="hidden"
                              name="endsOn"
                              value={quickFixTarget.item.endsOn}
                            />
                            <input
                              type="hidden"
                              name="timezone"
                              value={quickFixTarget.item.timezone}
                            />
                            <input
                              type="hidden"
                              name="budget"
                              value={quickFixTarget.item.budget}
                            />
                            <input
                              type="hidden"
                              name="attributionWindowDays"
                              value={quickFixTarget.item.attributionWindowDays}
                            />
                            <input
                              type="hidden"
                              name="grossMarginPercent"
                              value={Math.round(
                                quickFixTarget.item.grossMarginBps / 100,
                              )}
                            />
                            {quickFixTarget.checkKey !== 'event_objective' ? (
                              <input
                                type="hidden"
                                name="objective"
                                value={quickFixTarget.item.objective || ''}
                              />
                            ) : null}
                            {quickFixTarget.checkKey !== 'event_products' ? (
                              <input
                                type="hidden"
                                name="products"
                                value={quickFixTarget.item.products.join(', ')}
                              />
                            ) : null}
                            <input
                              type="hidden"
                              name="targetAccounts"
                              value={quickFixTarget.item.targetAccounts.join(
                                ', ',
                              )}
                            />
                            {quickFixTarget.checkKey !==
                            'qualification_questions' ? (
                              <input
                                type="hidden"
                                name="qualificationQuestions"
                                value={quickFixTarget.item.qualificationQuestions.join(
                                  ', ',
                                )}
                              />
                            ) : null}
                            <input
                              type="hidden"
                              name="leadFieldSchema"
                              value={quickFixTarget.item.leadFieldSchema.join(
                                ', ',
                              )}
                            />
                            {quickFixTarget.checkKey !== 'assigned_team'
                              ? quickFixTarget.item.teamMemberIds.map((id) => (
                                  <input
                                    key={id}
                                    type="hidden"
                                    name="teamMemberIds"
                                    value={id}
                                  />
                                ))
                              : null}
                            <input
                              type="hidden"
                              name="leadRoutingRule"
                              value={quickFixTarget.item.leadRoutingRule}
                            />
                            <input
                              type="hidden"
                              name="followupSlaHours"
                              value={quickFixTarget.item.followupSlaHours}
                            />
                            <input
                              type="hidden"
                              name="dailyLeadTarget"
                              value={quickFixTarget.item.dailyLeadTarget}
                            />
                            <input
                              type="hidden"
                              name="badgeProvider"
                              value={quickFixTarget.item.badgeProvider || ''}
                            />
                            <Button className="save-button" type="submit">
                              Save and re-check readiness
                            </Button>
                          </form>
                        </>
                      ) : null}
                    </DialogContent>
                  </Dialog>
                  <section
                    className="events-workspace"
                    aria-label="Configured events"
                  >
                    <p className="workspace-intro">
                      Manage event configuration, readiness and lead capture.
                    </p>
                    {activeEvent ? (
                      <div className="lead-event">
                        <h2 className="workspace-label">Active event</h2>
                        <article className="panel event-hero">
                          <div className="event-hero-head">
                            <span className="calendar-tile">
                              <b>
                                {new Date(
                                  `${activeEvent.startsOn}T00:00:00`,
                                ).toLocaleDateString('en', { day: '2-digit' })}
                              </b>
                              <small>
                                {new Date(
                                  `${activeEvent.startsOn}T00:00:00`,
                                ).toLocaleDateString('en', { month: 'short' })}
                              </small>
                            </span>
                            <div className="event-hero-identity">
                              <h3>{activeEvent.name}</h3>
                              <p>
                                {activeEvent.venue || 'Venue pending'}
                            {activeEvent.hall ? ` · Hall ${activeEvent.hall}` : ''}
                            {activeEvent.booth ? ` · Booth ${activeEvent.booth}` : ''}
                              </p>
                              <p className="event-hero-objective">
                                {activeEvent.objective ||
                                  'Business objective not added yet.'}
                              </p>
                            </div>
                            <span className="event-status-group">
                              <b className={`event-status ${activeEvent.status}`}>
                                {activeEvent.status}
                              </b>
                              {activeEvent.directoryVisibility ===
                              'published' ? (
                                <b className="event-status published">
                                  In directory
                                </b>
                              ) : null}
                            </span>
                          </div>
                          <div className="event-meta">
                            <span>
                              <small>Dates</small>
                              <strong>
                                {eventDates(
                                  activeEvent.startsOn,
                                  activeEvent.endsOn,
                                )}
                              </strong>
                            </span>
                            <span>
                              <small>Budget</small>
                              <strong>
                                {appContext?.workspace.currency || 'INR'}{' '}
                                {activeEvent.budget.toLocaleString()}
                              </strong>
                            </span>
                            <span>
                              <small>Follow-up</small>
                              <strong>
                                {activeEvent.followupSlaHours}h SLA
                              </strong>
                            </span>
                            <span>
                              <small>QR campaign</small>
                              <strong>
                                {activeEvent.qrCampaignCode || 'Pending'}
                              </strong>
                            </span>
                          </div>
                          {activeEvent.products.length ? (
                            <div className="event-tags">
                              {activeEvent.products.map((product) => (
                                <span key={product}>{product}</span>
                              ))}
                            </div>
                          ) : null}
                          {renderEventReadiness(activeEvent)}
                          <div className="event-hero-actions">
                            <Button
                              type="button"
                              onClick={() => selectEvent(activeEvent.id)}
                            >
                              <Check /> Active event
                            </Button>
                            {canManageEvents ? (
                              <div className="event-actions-secondary">
                                {activeEvent.status === 'active' ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      eventAction(
                                        'assess_readiness',
                                        activeEvent.id,
                                      )
                                    }
                                  >
                                    Recheck
                                  </button>
                                ) : null}
                                {activeEvent.status === 'active' ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      toggleDirectoryVisibility(activeEvent)
                                    }
                                  >
                                    {activeEvent.directoryVisibility ===
                                    'published'
                                      ? 'Unpublish'
                                      : 'Publish'}
                                  </button>
                                ) : null}
                                <button
                                  type="button"
                                  onClick={() => editEvent(activeEvent)}
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    eventAction('duplicate', activeEvent.id)
                                  }
                                >
                                  Duplicate
                                </button>
                                <button
                                  className="danger-link"
                                  type="button"
                                  onClick={() =>
                                    eventAction('archive', activeEvent.id)
                                  }
                                >
                                  Archive
                                </button>
                              </div>
                            ) : null}
                          </div>
                        </article>
                      </div>
                    ) : null}
                    <div className="event-index">
                      <h2 className="workspace-label">
                        {activeEvent ? 'Other events' : 'All events'}
                      </h2>
                      <nav className="entity-tabs" aria-label="Event status">
                        {(
                          [
                            ['all', 'All'],
                            ['active', 'Active'],
                            ['ready', 'Ready'],
                            ['draft', 'Draft'],
                            ['archived', 'Archived'],
                          ] as const
                        ).map(([key, label]) => (
                          <button
                            type="button"
                            key={key}
                            className={eventTab === key ? 'current' : ''}
                            aria-current={
                              eventTab === key ? 'page' : undefined
                            }
                            onClick={() => setEventTab(key)}
                          >
                            {label} <b>{eventCounts[key]}</b>
                          </button>
                        ))}
                      </nav>
                      <div className="entity-toolbar">
                        <label className="entity-search">
                          <Search size={15} />
                          <input
                            value={eventQuery}
                            onChange={(event) =>
                              setEventQuery(event.currentTarget.value)
                            }
                            placeholder="Search events…"
                            aria-label="Search events"
                          />
                        </label>
                        <div className="entity-toolbar-actions">
                          <select
                            aria-label="Sort events"
                            value={eventSort}
                            onChange={(event) =>
                              setEventSort(event.currentTarget.value)
                            }
                          >
                            <option value="recent">Latest start date</option>
                            <option value="earliest">
                              Earliest start date
                            </option>
                            <option value="az">Name A–Z</option>
                          </select>
                          {canManageEvents ? (
                            <Button
                              type="button"
                              className="capture-button"
                              onClick={newEvent}
                            >
                              <Plus /> New event
                            </Button>
                          ) : null}
                        </div>
                      </div>
                      <div className="event-table">
                        <div className="event-head event-grid" aria-hidden="true">
                          <span>Event</span>
                          <span>Dates</span>
                          <span>Venue</span>
                          <span>Status</span>
                          <span>Actions</span>
                        </div>
                        {eventRows.map((item) => (
                          <div
                            className={`event-row ${item.status === 'archived' ? 'archived' : ''}`}
                            key={item.id}
                          >
                            <div className="event-grid">
                              <span className="event-row-name">
                                {canManageEvents &&
                                item.status !== 'archived' ? (
                                  <button
                                    type="button"
                                    onClick={() => editEvent(item)}
                                  >
                                    {item.name}
                                  </button>
                                ) : (
                                  <strong>{item.name}</strong>
                                )}
                              </span>
                              <span data-label="Dates">
                                {eventDates(item.startsOn, item.endsOn)}
                              </span>
                              <span data-label="Venue">
                                {item.venue || 'Venue pending'}
                            {item.hall ? ` · Hall ${item.hall}` : ''}
                            {item.booth ? ` · Booth ${item.booth}` : ''}
                              </span>
                              <span className="event-status-group">
                                <b className={`event-status ${item.status}`}>
                                  {item.status}
                                </b>
                                {item.directoryVisibility === 'published' ? (
                                  <b className="event-status published">
                                    In directory
                                  </b>
                                ) : null}
                              </span>
                              <span className="event-row-actions">
                                {item.status === 'active' ? (
                                  <button
                                    type="button"
                                    className="row-primary"
                                    onClick={() => selectEvent(item.id)}
                                  >
                                    Use for capture
                                  </button>
                                ) : null}
                                {canManageEvents && item.status === 'ready' ? (
                                  <button
                                    type="button"
                                    className="row-primary"
                                    onClick={() =>
                                      eventAction('activate', item.id)
                                    }
                                  >
                                    Activate
                                  </button>
                                ) : null}
                                {canManageEvents && item.status === 'draft' ? (
                                  <button
                                    type="button"
                                    className="row-primary"
                                    onClick={() =>
                                      eventAction('assess_readiness', item.id)
                                    }
                                  >
                                    Run readiness
                                  </button>
                                ) : null}
                                {canManageEvents &&
                                item.status === 'active' ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      eventAction('assess_readiness', item.id)
                                    }
                                  >
                                    Recheck
                                  </button>
                                ) : null}
                                {canManageEvents &&
                                item.status === 'active' ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      toggleDirectoryVisibility(item)
                                    }
                                  >
                                    {item.directoryVisibility === 'published'
                                      ? 'Unpublish'
                                      : 'Publish'}
                                  </button>
                                ) : null}
                                {canManageEvents ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      eventAction('duplicate', item.id)
                                    }
                                  >
                                    Duplicate
                                  </button>
                                ) : null}
                                {canManageEvents &&
                                item.status !== 'archived' ? (
                                  <button
                                    className="danger-link"
                                    type="button"
                                    onClick={() =>
                                      eventAction('archive', item.id)
                                    }
                                  >
                                    Archive
                                  </button>
                                ) : null}
                              </span>
                            </div>
                            {item.readinessChecks.length ? (
                              <div className="event-row-readiness">
                                {renderEventReadiness(item)}
                              </div>
                            ) : null}
                          </div>
                        ))}
                        {!eventRows.length ? (
                          <div className="entity-empty">
                            <strong>
                              {events.length
                                ? 'No events match this view'
                                : 'No event configured'}
                            </strong>
                            <p>
                              {events.length
                                ? 'Try another status tab or clear the search.'
                                : 'Create the first event playbook. It stays in draft until selected for capture.'}
                            </p>
                            {!events.length && canManageEvents ? (
                              <Button
                                type="button"
                                variant="outline"
                                onClick={newEvent}
                              >
                                New event
                              </Button>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </section>
                </div>
              ) : null}
              {activeView === 'roi' ? (
                <div className="roi-layout">
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
                      <strong
                        className={roiTone(revenueReport?.revenueRoiPercent)}
                      >
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
                      <strong
                        className={roiTone(revenueReport?.profitRoiPercent)}
                      >
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
                        {!activeEventId ? (
                          <p className="field-help">
                            Costs attach to an event. Select an active event in
                            Events to record one.
                          </p>
                        ) : null}
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
                      <dl className="reconcile-list">
                        <div>
                          <dt>Accepted quotation value</dt>
                          <dd>
                            {money(
                              revenueReport?.reconciliation
                                .acceptedQuotationValue || 0,
                              appContext?.workspace.currency,
                            )}
                          </dd>
                        </div>
                        <div>
                          <dt>Won without accepted quotation</dt>
                          <dd>
                            {revenueReport?.reconciliation
                              .wonWithoutAcceptedQuotation || 0}
                          </dd>
                        </div>
                        <div>
                          <dt>Accepted quotation without won opportunity</dt>
                          <dd>
                            {revenueReport?.reconciliation
                              .acceptedQuotationWithoutWonOpportunity || 0}
                          </dd>
                        </div>
                        <div>
                          <dt>Outside attribution window</dt>
                          <dd>
                            {revenueReport?.reconciliation
                              .excludedOutsideAttributionWindow || 0}
                          </dd>
                        </div>
                      </dl>
                      <div className="export-actions">
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
              {activeView === 'knowledge' &&
              knowledgeState === 'error' &&
              !knowledge.profile ? (
                <div className="knowledge-layout">
                  <p className="workspace-intro">
                    Define the company context used across Revenue OS.
                  </p>
                  <article className="panel empty-state large">
                    <AlertTriangle />
                    <h2>Could not load company knowledge</h2>
                    <p>The request to the workspace failed.</p>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void loadKnowledge()}
                    >
                      Retry
                    </Button>
                  </article>
                </div>
              ) : null}
              {activeView === 'knowledge' &&
              knowledgeState !== 'ready' &&
              knowledgeState !== 'error' &&
              !knowledge.profile ? (
                <div className="knowledge-layout">
                  <p className="workspace-intro">
                    Define the company context used across Revenue OS.
                  </p>
                  <article className="panel empty-state large">
                    <p>Loading company knowledge…</p>
                  </article>
                </div>
              ) : null}
              {activeView === 'knowledge' &&
              (knowledgeState === 'ready' || knowledge.profile) ? (
                <div className="knowledge-layout">
                  <p className="workspace-intro">
                    Define the company context used across Revenue OS.
                  </p>
                  <article
                    className={`panel onboarding-progress ${knowledgeSetupDone === 4 ? 'complete' : ''}`}
                  >
                    <div>
                      <span>
                        {knowledgeSetupDone}
                        <small>/4</small>
                      </span>
                      <div>
                        <h2>Company intelligence setup</h2>
                        <p>
                          {knowledgeSetupDone === 4
                            ? 'All required company context is configured.'
                            : knowledge.profile
                              ? 'Profile saved. Add products, target customers and evidence.'
                              : 'Start by explaining what the company sells and whom it serves.'}
                        </p>
                      </div>
                    </div>
                    <div className="progress-track">
                      <i style={{ width: `${knowledgeSetupDone * 25}%` }} />
                    </div>
                  </article>
                  <h3 className="settings-group">Company profile</h3>
                  <article className="panel knowledge-card">
                    <h2>Business profile</h2>
                    <form
                      className="lead-form profile-form"
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
                    {currentProfileVersion ? (
                      /* Version history is metadata about the form above it,
                         not a third content section. */
                      <div className="profile-version">
                        <span>
                          <strong>
                            Profile version {currentProfileVersion.version}
                          </strong>
                          <small>
                            {currentProfileVersion.changeReason} ·{' '}
                            {dateTime(currentProfileVersion.createdAt)}
                          </small>
                        </span>
                        <b>v{currentProfileVersion.version}</b>
                      </div>
                    ) : null}
                    {knowledge.profileVersions.length > 1 ? (
                      <details className="profile-history">
                        <summary>
                          <span>
                            {knowledge.profileVersions.length - 1} earlier{' '}
                            {knowledge.profileVersions.length === 2
                              ? 'version'
                              : 'versions'}
                          </span>
                          <ChevronDown size={14} />
                        </summary>
                        <div className="knowledge-records">
                          {knowledge.profileVersions.slice(1).map((item) => (
                            <div key={item.id}>
                              <span>
                                <strong>Profile version {item.version}</strong>
                                <small>
                                  {item.changeReason} ·{' '}
                                  {dateTime(item.createdAt)}
                                </small>
                              </span>
                              <b>v{item.version}</b>
                            </div>
                          ))}
                        </div>
                      </details>
                    ) : null}
                  </article>
                  <h3 className="settings-group">Knowledge base</h3>
                  <article className="panel knowledge-card">
                    <h2>Approved claims</h2>
                    <p className="field-help">
                      Only approved claims may be supplied to AI-generated
                      follow-ups.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      className="knowledge-add"
                      onClick={() => setKnowledgeDialog('add_claim')}
                    >
                      <Plus /> Add claim
                    </Button>
                    <Dialog
                      open={knowledgeDialog === 'add_claim'}
                      onOpenChange={(open) =>
                        setKnowledgeDialog(open ? 'add_claim' : null)
                      }
                    >
                      <DialogContent className="capture-dialog">
                        <DialogHeader>
                          <DialogTitle>Add approved claim</DialogTitle>
                          <DialogDescription>
                            Only approved claims may be supplied to AI-generated follow-ups.
                          </DialogDescription>
                        </DialogHeader>
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
                      </DialogContent>
                    </Dialog>
                    <div className="knowledge-records">
                      {!knowledge.claims.length ? (
                        <p className="knowledge-empty">No approved claims yet.</p>
                      ) : null}
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
                    <Button
                      type="button"
                      variant="outline"
                      className="knowledge-add"
                      onClick={() => setKnowledgeDialog('add_product')}
                    >
                      <Plus /> Add offering
                    </Button>
                    <Dialog
                      open={knowledgeDialog === 'add_product'}
                      onOpenChange={(open) =>
                        setKnowledgeDialog(open ? 'add_product' : null)
                      }
                    >
                      <DialogContent className="capture-dialog">
                        <DialogHeader>
                          <DialogTitle>Add product or service</DialogTitle>
                          <DialogDescription>
                            What you sell, who buys it, and the pain it removes.
                          </DialogDescription>
                        </DialogHeader>
                        <form
                          className="lead-form compact-form"
                          onSubmit={submitKnowledge}
                        >
                          <input type="hidden" name="action" value="add_product" />
                          <div className="field-grid">
                            <div className="field-block">
                              <label htmlFor="product-name">Name</label>
                              <Input
                                id="product-name"
                                name="name"
                                required
                                placeholder="Product or service name"
                              />
                            </div>
                            <div className="field-block">
                              <label htmlFor="product-kind">Type</label>
                              <select
                                id="product-kind"
                                name="kind"
                                defaultValue="product"
                              >
                                <option value="product">Product</option>
                                <option value="service">Service</option>
                              </select>
                            </div>
                          </div>
                          <div className="field-block">
                            <label htmlFor="product-description">
                              What it does
                            </label>
                            <Textarea
                              id="product-description"
                              name="description"
                              placeholder="What it does and the outcome it creates"
                            />
                          </div>
                          <div className="field-block">
                            <label htmlFor="product-roles">Buyer roles</label>
                            <Input
                              id="product-roles"
                              name="buyerRoles"
                              placeholder="Comma separated"
                            />
                          </div>
                          <div className="field-block">
                            <label htmlFor="product-pains">Pain points solved</label>
                            <Input
                              id="product-pains"
                              name="painPoints"
                              placeholder="Comma separated"
                            />
                          </div>
                          <Button type="submit">Add offering</Button>
                        </form>
                      </DialogContent>
                    </Dialog>
                    <div className="knowledge-records">
                      {!knowledge.products.length ? (
                        <p className="knowledge-empty">No offerings added yet.</p>
                      ) : null}
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
                    <Button
                      type="button"
                      variant="outline"
                      className="knowledge-add"
                      onClick={() => setKnowledgeDialog('add_icp')}
                    >
                      <Plus /> Add profile
                    </Button>
                    <Dialog
                      open={knowledgeDialog === 'add_icp'}
                      onOpenChange={(open) =>
                        setKnowledgeDialog(open ? 'add_icp' : null)
                      }
                    >
                      <DialogContent className="capture-dialog">
                        <DialogHeader>
                          <DialogTitle>Add ideal customer profile</DialogTitle>
                          <DialogDescription>
                            Who you are trying to reach, and who to rule out.
                          </DialogDescription>
                        </DialogHeader>
                        <form
                          className="lead-form compact-form"
                          onSubmit={submitKnowledge}
                        >
                          <input type="hidden" name="action" value="add_icp" />
                          <div className="field-block">
                            <label htmlFor="icp-name">Profile name</label>
                            <Input
                              id="icp-name"
                              name="name"
                              required
                              placeholder="e.g. Multi-site pharmaceutical plants"
                            />
                          </div>
                          <div className="field-block">
                            <label htmlFor="icp-industries">Industries</label>
                            <Input
                              id="icp-industries"
                              name="industries"
                              placeholder="Industries, comma separated"
                            />
                          </div>
                          <div className="field-block">
                            <label htmlFor="icp-sizes">Company sizes</label>
                            <Input
                              id="icp-sizes"
                              name="companySizes"
                              placeholder="e.g. 200–5,000 employees"
                            />
                          </div>
                          <div className="field-block">
                            <label htmlFor="icp-geographies">Target regions</label>
                            <Input
                              id="icp-geographies"
                              name="geographies"
                              placeholder="Target regions"
                            />
                          </div>
                          <div className="field-block">
                            <label htmlFor="icp-roles">Decision-maker roles</label>
                            <Input
                              id="icp-roles"
                              name="buyerRoles"
                              placeholder="Decision-maker roles"
                            />
                          </div>
                          <div className="field-block">
                            <label htmlFor="icp-signals">High-value signals</label>
                            <Textarea
                              id="icp-signals"
                              name="mustHaveSignals"
                              placeholder="Comma separated"
                            />
                          </div>
                          <div className="field-block">
                            <label htmlFor="icp-disqualifiers">Disqualifiers</label>
                            <Textarea
                              id="icp-disqualifiers"
                              name="disqualifiers"
                              placeholder="Comma separated"
                            />
                          </div>
                          <Button type="submit">Add ideal customer profile</Button>
                        </form>
                      </DialogContent>
                    </Dialog>
                    <div className="knowledge-records">
                      {!knowledge.icps.length ? (
                        <p className="knowledge-empty">No customer profiles added yet.</p>
                      ) : null}
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
                    <Button
                      type="button"
                      variant="outline"
                      className="knowledge-add"
                      onClick={() => setKnowledgeDialog('add_rule')}
                    >
                      <Plus /> Add rule
                    </Button>
                    <Dialog
                      open={knowledgeDialog === 'add_rule'}
                      onOpenChange={(open) =>
                        setKnowledgeDialog(open ? 'add_rule' : null)
                      }
                    >
                      <DialogContent className="capture-dialog">
                        <DialogHeader>
                          <DialogTitle>Add qualification rule</DialogTitle>
                          <DialogDescription>
                            Scored signals that qualify a conversation.
                          </DialogDescription>
                        </DialogHeader>
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
                      </DialogContent>
                    </Dialog>
                    <div className="knowledge-records">
                      {!knowledge.rules.length ? (
                        <p className="knowledge-empty">No qualification rules added yet.</p>
                      ) : null}
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
                  <h3 className="settings-group">Evidence</h3>
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
                      {!knowledge.sources.length ? (
                        <p className="knowledge-empty">No knowledge sources added yet.</p>
                      ) : null}
                      {knowledge.sources.map((item) => (
                        <div key={item.id}>
                          <span>
                            <strong>{item.name}</strong>
                            {/* What the source is, then how it was ingested.
                                The hash matters for provenance but should not
                                be the first thing read. */}
                            <small>
                              {item.status.replaceAll('_', ' ')} ·{' '}
                              {item.sourceType}
                              {item.sizeBytes
                                ? ` · ${Math.ceil(item.sizeBytes / 1024)} KB`
                                : ''}
                              {item.createdAt
                                ? ` · added ${dateTime(item.createdAt)}`
                                : ''}
                            </small>
                            {item.ingestionStatus ? (
                              <small className="source-technical">
                                Ingestion{' '}
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
                                {dateTime(merge.mergedAt)}
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
                  <h3 className="settings-group">Workspace</h3>
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
                            <strong>
                              {workspace.name}
                              {workspace.kind === 'visitor' ? (
                                <em className="workspace-kind-tag">
                                  Personal
                                </em>
                              ) : null}
                            </strong>
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
                    {!availableWorkspaces.some(
                      (workspace) => workspace.kind === 'visitor',
                    ) ? (
                      <button
                        type="button"
                        className="visitor-mode-link"
                        onClick={enterVisitorMode}
                      >
                        Also attending events yourself? Open your personal
                        visitor workspace →
                      </button>
                    ) : null}
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
                            ? 'Transcription, conversation analysis, RFQ extraction and follow-up drafting are configured. Card, badge and QR reading always work locally and never need this.'
                            : 'AI assistance is unavailable in this environment. Card, badge and QR reading run entirely on-device and are unaffected. Transcription, conversation analysis, RFQ extraction and follow-up drafting need an AI provider key, which is not configured here.'}
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
                  <h3 className="settings-group">Operations</h3>
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
                                {dateTime(grant.expiresAt)}
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
                  <h3 className="settings-group">Team and access</h3>
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
                  <h3 className="settings-group">Security and data</h3>
                  {appContext?.role === 'owner' ? (
                    <article className="panel settings-card danger-card">
                      <div className="settings-heading">
                        <Trash2 />
                        <div>
                          <h2>Workspace deletion</h2>
                          <p>
                            {deletionRequest
                              ? `Scheduled for ${dateTime(deletionRequest.scheduledFor)}. You can cancel until that time.`
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
                            variant="destructive"
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
                      <>
                        {auditEvents
                          .slice(
                            auditPage * AUDIT_PAGE_SIZE,
                            auditPage * AUDIT_PAGE_SIZE + AUDIT_PAGE_SIZE,
                          )
                          .map((item) => (
                            <div className="audit-row" key={item.id}>
                              <span>{item.action.replaceAll('.', ' ')}</span>
                              <small>
                                {item.entityType} ·{' '}
                                {dateTime(item.createdAt)}
                              </small>
                            </div>
                          ))}
                        {auditPageCount > 1 ? (
                          <nav className="pager" aria-label="Security activity pages">
                            <button
                              type="button"
                              disabled={auditPage === 0}
                              onClick={() => setAuditPage((p) => p - 1)}
                            >
                              Previous
                            </button>
                            <span className="pager-pages">
                              {Array.from({ length: auditPageCount }).map(
                                (_, index) => (
                                  <button
                                    key={index}
                                    type="button"
                                    className={
                                      index === auditPage ? 'current' : ''
                                    }
                                    aria-current={
                                      index === auditPage ? 'page' : undefined
                                    }
                                    onClick={() => setAuditPage(index)}
                                  >
                                    {index + 1}
                                  </button>
                                ),
                              )}
                            </span>
                            <button
                              type="button"
                              disabled={auditPage >= auditPageCount - 1}
                              onClick={() => setAuditPage((p) => p + 1)}
                            >
                              Next
                            </button>
                          </nav>
                        ) : null}
                      </>
                    ) : (
                      <div className="empty-state">
                        No recorded workspace changes yet.
                      </div>
                    )}
                  </article>
                </div>
              ) : null}
              {activeView === 'visitor-discover' ? (
                <div className="records-grid">
                  <article className="panel">
                    <div className="settings-heading">
                      <Search />
                      <div>
                        <h2>Discover</h2>
                        <p>
                          Search exhibitors who have published their event to
                          the directory. Only what they&apos;ve chosen to
                          share is shown here.
                        </p>
                      </div>
                    </div>
                    <div className="field-block">
                      <Input
                        placeholder="Search by company, product or event name"
                        value={directoryQuery}
                        onChange={(event) => {
                          setDirectoryQuery(event.currentTarget.value);
                          void searchDirectory(event.currentTarget.value);
                        }}
                      />
                    </div>
                  </article>
                  <section aria-label="Directory results">
                    {directoryLoading ? (
                      <article className="panel empty-state large">
                        <p>Searching…</p>
                      </article>
                    ) : directoryEntries.length ? (
                      directoryEntries.map((entry) => (
                        <article
                          className="panel directory-card"
                          key={entry.eventId}
                        >
                          <div>
                            <strong>{entry.companyName}</strong>
                            <small>
                              {entry.eventName}
                              {entry.venue ? ` · ${entry.venue}` : ''}
                              {entry.booth ? ` · Booth ${entry.booth}` : ''}
                            </small>
                          </div>
                          {entry.companyDescription ? (
                            <p>{entry.companyDescription}</p>
                          ) : null}
                          {entry.products.length ? (
                            <div className="event-tags">
                              {entry.products.map((product) => (
                                <span key={product}>{product}</span>
                              ))}
                            </div>
                          ) : null}
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() =>
                              entry.code && joinEventByCode(entry.code)
                            }
                            disabled={!entry.code}
                          >
                            Join event
                          </Button>
                        </article>
                      ))
                    ) : (
                      <article className="panel empty-state large">
                        <Search />
                        <h2>No published events yet</h2>
                        <p>
                          Nothing matches your search, or no exhibitor has
                          published to the directory yet. Try Event home to
                          join by code instead.
                        </p>
                      </article>
                    )}
                  </section>
                </div>
              ) : null}
              {activeView === 'visitor-plan' ? (
                !activeEvent ? (
                  <div className="visitor-placeholder">
                    <article className="panel empty-state large">
                      <CalendarDays />
                      <h2>No active event</h2>
                      <p>
                        Join or create an event before building a plan.
                      </p>
                      <Button
                        type="button"
                        onClick={() => go('visitor-home')}
                      >
                        Go to Event home
                      </Button>
                    </article>
                  </div>
                ) : (
                  <div className="visitor-home-layout">
                    <article className="panel">
                      <div className="settings-heading">
                        <CalendarDays />
                        <div>
                          <h2>Add to your plan</h2>
                          <p>
                            Attending {activeEvent.name}. Add a booth visit,
                            session or reminder.
                          </p>
                        </div>
                      </div>
                      <form className="lead-form" onSubmit={addItineraryItem}>
                        <div className="field-block">
                          <label htmlFor="itinerary-title">Title</label>
                          <Input
                            id="itinerary-title"
                            name="title"
                            required
                            placeholder="Visit MachineSight booth"
                          />
                        </div>
                        <div className="field-block">
                          <label htmlFor="itinerary-starts">
                            Date and time
                          </label>
                          <Input
                            id="itinerary-starts"
                            name="startsAt"
                            type="datetime-local"
                          />
                        </div>
                        <div className="field-block">
                          <label htmlFor="itinerary-notes">Notes</label>
                          <Textarea id="itinerary-notes" name="notes" />
                        </div>
                        <Button type="submit" className="save-button">
                          Add to plan
                        </Button>
                      </form>
                    </article>
                    <section className="event-list" aria-label="Your plan">
                      {itineraryItems.length ? (
                        itineraryItems.map((item) => (
                          <article className="panel event-record" key={item.id}>
                            <div>
                              <strong>{item.title}</strong>
                              <br />
                              <small>
                                {item.startsAt
                                  ? dateTime(item.startsAt)
                                  : 'No time set'}{' '}
                                ·{' '}
                                {item.status === 'in_progress'
                                  ? 'in progress'
                                  : item.status}
                              </small>
                              {item.notes ? <p>{item.notes}</p> : null}
                            </div>
                            <div className="event-actions">
                              {item.status !== 'visited' ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateItineraryStatus(item.id, 'visited')
                                  }
                                >
                                  Mark visited
                                </button>
                              ) : null}
                              {item.status !== 'skipped' &&
                              item.status !== 'visited' ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateItineraryStatus(item.id, 'skipped')
                                  }
                                >
                                  Skip
                                </button>
                              ) : null}
                              {item.status !== 'cancelled' &&
                              item.status !== 'visited' ? (
                                <button
                                  className="danger-link"
                                  type="button"
                                  onClick={() =>
                                    updateItineraryStatus(
                                      item.id,
                                      'cancelled',
                                    )
                                  }
                                >
                                  Cancel
                                </button>
                              ) : null}
                            </div>
                          </article>
                        ))
                      ) : (
                        <article className="panel empty-state large">
                          <CalendarDays />
                          <h2>Nothing planned yet</h2>
                          <p>Add a booth visit or session on the left.</p>
                        </article>
                      )}
                    </section>
                  </div>
                )
              ) : null}
              {activeView === 'visitor-memory' ? (
                <div className="records-grid">
                  <article className="panel records-panel">
                    <h2>Memory</h2>
                    <p className="field-help">
                      Search your own captured contacts and conversation
                      notes across every event you&apos;ve attended.
                    </p>
                    <Input
                      placeholder="Search by name, company or note"
                      value={memoryQuery}
                      onChange={(event) =>
                        setMemoryQuery(event.currentTarget.value)
                      }
                    />
                  </article>
                  <article className="panel records-panel">
                    {(() => {
                      const query = memoryQuery.trim().toLowerCase();
                      const matches = query
                        ? capturedLeads.filter((lead) =>
                            [lead.fullName, lead.company, lead.role, lead.note]
                              .filter(Boolean)
                              .join(' ')
                              .toLowerCase()
                              .includes(query),
                          )
                        : capturedLeads;
                      if (!matches.length)
                        return (
                          <div className="empty-state">
                            {query
                              ? 'No evidence matches that search.'
                              : 'Nothing captured yet.'}
                          </div>
                        );
                      return matches.map((lead) => (
                        <div className="record-row" key={lead.id}>
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
                              {lead.company}
                              {lead.note ? ` · ${lead.note}` : ''}
                            </small>
                          </span>
                        </div>
                      ));
                    })()}
                  </article>
                </div>
              ) : null}
              {activeView === 'visitor-home' ? (
                <div className="visitor-home-layout">
                  <article className="panel">
                    <div className="settings-heading">
                      <CalendarDays />
                      <div>
                        <h2>Attend an event</h2>
                        <p>
                          Join the event using the code an exhibitor shared
                          with you, or create a private event of your own —
                          it stays visible only to you.
                        </p>
                      </div>
                    </div>
                    <form
                      className="lead-form"
                      onSubmit={joinCanonicalEvent}
                    >
                      <div className="field-block">
                        <label htmlFor="visitor-join-code">Event code</label>
                        <Input
                          id="visitor-join-code"
                          name="code"
                          placeholder="e.g. 8B860DFE"
                        />
                      </div>
                      <Button type="submit" variant="outline">
                        Join event
                      </Button>
                    </form>
                    <div className="or">
                      <span>or create a private event</span>
                    </div>
                    <form
                      className="lead-form"
                      onSubmit={createVisitorEvent}
                    >
                      <div className="field-block">
                        <label htmlFor="visitor-event-name">
                          Event name
                        </label>
                        <Input
                          id="visitor-event-name"
                          name="name"
                          required
                          placeholder="IndustrialTech Expo 2027"
                        />
                      </div>
                      <div className="field-grid">
                        <div className="field-block">
                          <label htmlFor="visitor-event-venue">Venue</label>
                          <Input
                            id="visitor-event-venue"
                            name="venue"
                            placeholder="Bombay Exhibition Centre"
                          />
                        </div>
                        <div className="field-block">
                          <label htmlFor="visitor-event-timezone">
                            Timezone
                          </label>
                          <Input
                            id="visitor-event-timezone"
                            name="timezone"
                            defaultValue={
                              appContext?.workspace.timezone ||
                              'Asia/Kolkata'
                            }
                          />
                        </div>
                      </div>
                      <div className="field-grid">
                        <div className="field-block">
                          <label htmlFor="visitor-event-starts">
                            Starts
                          </label>
                          <Input
                            id="visitor-event-starts"
                            name="startsOn"
                            type="date"
                            required
                          />
                        </div>
                        <div className="field-block">
                          <label htmlFor="visitor-event-ends">Ends</label>
                          <Input
                            id="visitor-event-ends"
                            name="endsOn"
                            type="date"
                            required
                          />
                        </div>
                      </div>
                      <Button type="submit" className="save-button">
                        Create private event
                      </Button>
                    </form>
                  </article>
                  <section className="event-list" aria-label="Your events">
                    <div className="event-list-heading">
                      <div>
                        <h2>Your events</h2>
                        <p>The active event is used for new captures.</p>
                      </div>
                    </div>
                    {events.length ? (
                      events.map((item) => (
                        <article
                          className={`panel event-record ${item.id === activeEventId ? 'selected' : ''}`}
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
                                ).toLocaleDateString('en', {
                                  month: 'short',
                                })}
                              </small>
                            </span>
                            <span>
                              <strong>{item.name}</strong>
                              <small>
                                {item.venue || 'Venue pending'}
                                {item.canonicalEventId
                                  ? ' · linked to an exhibitor event'
                                  : ' · private event'}
                              </small>
                            </span>
                          </div>
                          <div className="event-actions">
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
                          </div>
                        </article>
                      ))
                    ) : (
                      <article className="panel empty-state large">
                        <CalendarDays />
                        <h2>No events yet</h2>
                        <p>
                          Join or create one to start capturing contacts.
                        </p>
                      </article>
                    )}
                  </section>
                </div>
              ) : null}
              {activeView === 'visitor-capture' ? (
                <VisitorCapture
                  activeEvent={activeEvent}
                  onSaved={() => void loadWorkspace()}
                  setNotice={setNotice}
                  onGoToEventHome={() => go('visitor-home')}
                />
              ) : null}
              {activeView === 'visitor-contacts' ? (
                <div className="records-grid">
                  <article className="panel records-panel">
                    <div className="event-list-heading">
                      <h2>My contacts</h2>
                      <label className="show-archived-toggle">
                        <input
                          type="checkbox"
                          checked={showArchivedContacts}
                          onChange={(event) =>
                            setShowArchivedContacts(
                              event.currentTarget.checked,
                            )
                          }
                        />
                        Show archived
                      </label>
                    </div>
                    {(() => {
                      const visible = capturedLeads.filter(
                        (lead) =>
                          showArchivedContacts ||
                          lead.relationshipStatus !== 'archived',
                      );
                      if (!visible.length)
                        return (
                          <div className="empty-state">
                            No contacts saved yet. Use Capture to add one.
                          </div>
                        );
                      return visible.map((lead) => (
                        <div className="contact-row-wrap" key={lead.id}>
                          <button
                            className="record-row"
                            onClick={() => openVisitorContact(lead)}
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
                                {lead.role || 'Role not added'} ·{' '}
                                {lead.company}
                              </small>
                            </span>
                            <small>{lead.email || lead.phone || ''}</small>
                          </button>
                          <button
                            type="button"
                            className="contact-archive-toggle"
                            onClick={() =>
                              setRelationshipStatus(
                                lead,
                                lead.relationshipStatus === 'archived'
                                  ? 'active'
                                  : 'archived',
                              )
                            }
                          >
                            {lead.relationshipStatus === 'archived'
                              ? 'Reopen'
                              : 'Archive'}
                          </button>
                        </div>
                      ));
                    })()}
                  </article>
                </div>
              ) : null}
              {activeView === 'visitor-followups' ? (
                !reviewLead ? (
                  <div className="records-grid">
                    <article className="panel records-panel">
                      <h2>Choose a contact to follow up with</h2>
                      {capturedLeads.length ? (
                        capturedLeads.map((lead) => (
                          <button
                            key={lead.id}
                            className="record-row"
                            onClick={() => openVisitorContact(lead)}
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
                                {lead.role || 'Role not added'} ·{' '}
                                {lead.company}
                              </small>
                            </span>
                          </button>
                        ))
                      ) : (
                        <div className="empty-state">
                          No contacts saved yet. Use Capture to add one.
                        </div>
                      )}
                    </article>
                  </div>
                ) : (
                  <div className="visitor-followup-detail">
                    <article className="panel">
                      <div className="settings-heading">
                        <FileText />
                        <div>
                          <h2>{reviewLead.fullName}</h2>
                          <p>{reviewLead.company}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="visitor-back-link"
                        onClick={() => setReviewLead(null)}
                      >
                        ← Choose a different contact
                      </button>
                      {analysisError ? (
                        <p className="form-error" role="alert">
                          {analysisError}
                        </p>
                      ) : null}
                      <div className="field-grid">
                        <div className="consent-cell">
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
                        <div className="consent-cell">
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
                      <div className="followup-buttons">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => generateFollowup('email')}
                          disabled={Boolean(drafting)}
                        >
                          {drafting === 'email' ? 'Drafting…' : 'Draft email'}
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
                      </div>
                    </article>
                    {followups.length ? (
                      <section className="followup-list">
                        {followups.map((draft) => (
                          <article className="panel followup-card" key={draft.id}>
                            <span>
                              <strong>
                                {draft.channel === 'email'
                                  ? 'Email'
                                  : 'WhatsApp'}
                              </strong>
                              <small>
                                To {draft.recipient} ·{' '}
                                {draft.status === 'handed_off'
                                  ? 'Handed off'
                                  : draft.status === 'approved'
                                    ? 'Approved'
                                    : 'Draft'}{' '}
                                · v{draft.version}
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
                                {draft.status === 'approved' ? (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() =>
                                      openApprovedFollowup(draft)
                                    }
                                  >
                                    Open{' '}
                                    {draft.channel === 'email'
                                      ? 'email'
                                      : 'WhatsApp'}
                                  </Button>
                                ) : draft.status === 'handed_off' ? (
                                  <span className="handoff-note">
                                    <Check size={13} /> Handed off
                                    {draft.handedOffAt
                                      ? ` · ${dateTime(draft.handedOffAt)}`
                                      : ''}{' '}
                                    — not confirmed sent
                                  </span>
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
                                  ) : draft.status === 'handed_off' ? (
                                    <>
                                      <Check /> Handed off
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
                  </div>
                )
              ) : null}
            </section>
          )}
        </div>
        {notice ? <output className="toast">{notice}</output> : null}
      </section>
      <Dialog
        open={Boolean(askState)}
        onOpenChange={(open) => {
          if (!open) closeAsk(null);
        }}
      >
        <DialogContent className="capture-dialog ask-dialog">
          <DialogHeader>
            <DialogTitle>{askState?.title}</DialogTitle>
            {askState?.description ? (
              <DialogDescription>{askState.description}</DialogDescription>
            ) : null}
          </DialogHeader>
          <form
            className="lead-form"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              const values: Record<string, string> = {};
              for (const field of askState?.fields || []) {
                const raw = data.get(field.name);
                values[field.name] = typeof raw === 'string' ? raw.trim() : '';
              }
              closeAsk(values);
            }}
          >
            {(askState?.fields || []).map((field) => (
              <div className="field-block" key={field.name}>
                <label htmlFor={`ask-${field.name}`}>{field.label}</label>
                {field.type === 'textarea' ? (
                  <Textarea
                    id={`ask-${field.name}`}
                    name={field.name}
                    required={field.required}
                    placeholder={field.placeholder}
                    defaultValue={field.defaultValue}
                  />
                ) : (
                  <Input
                    id={`ask-${field.name}`}
                    name={field.name}
                    type={field.type || 'text'}
                    required={field.required}
                    placeholder={field.placeholder}
                    defaultValue={field.defaultValue}
                  />
                )}
              </div>
            ))}
            <div className="ask-actions">
              <Button
                type="button"
                variant="outline"
                onClick={() => closeAsk(null)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant={askState?.destructive ? 'destructive' : 'default'}
              >
                {askState?.confirmLabel || 'Confirm'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
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
              {opportunityCandidates.length ? (
                <>
                  <select
                    id="opp-contacts"
                    name="contactIds"
                    multiple
                    defaultValue={opportunityLead ? [opportunityLead.id] : []}
                  >
                    {opportunityCandidates.map((lead) => (
                      <option key={lead.id} value={lead.id}>
                        {lead.fullName} · {lead.company} ·{' '}
                        {lead.buyingRole || lead.role || 'Contact'}
                      </option>
                    ))}
                  </select>
                  <small className="field-help">
                    Use Ctrl or Command to select multiple stakeholders.
                    Contacts must belong to the same account and event.
                  </small>
                </>
              ) : (
                /* An empty multi-select looked broken and gave no way
                   forward. Explain, and offer the action that fixes it. */
                <div className="field-empty">
                  <p>
                    No captured contacts for{' '}
                    {activeEvent ? activeEvent.name : 'this event'} yet.
                    Stakeholders come from contacts captured against the
                    active event.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setOpportunityOpen(false);
                      setCaptureOpen(true);
                    }}
                  >
                    Capture a contact
                  </Button>
                </div>
              )}
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
