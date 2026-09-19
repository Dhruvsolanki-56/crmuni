import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

export const workspaces = sqliteTable(
  'workspaces',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    timezone: text('timezone').notNull().default('Asia/Kolkata'),
    currency: text('currency').notNull().default('INR'),
    plan: text('plan').notNull().default('trial'),
    status: text('status').notNull().default('active'),
    createdBy: text('created_by').notNull(),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [uniqueIndex('uidx_workspaces_slug').on(table.slug)],
);

export const memberships = sqliteTable(
  'memberships',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    userId: text('user_id').notNull(),
    email: text('email').notNull(),
    displayName: text('display_name'),
    role: text('role').notNull().default('salesperson'),
    status: text('status').notNull().default('active'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    index('idx_memberships_user_status').on(table.userId, table.status),
    index('idx_memberships_workspace_status').on(
      table.workspaceId,
      table.status,
    ),
    uniqueIndex('uidx_memberships_workspace_user').on(
      table.workspaceId,
      table.userId,
    ),
  ],
);

export const supportAccessGrants = sqliteTable(
  'support_access_grants',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    supportUserId: text('support_user_id').notNull(),
    supportEmail: text('support_email').notNull(),
    reason: text('reason').notNull(),
    ticketReference: text('ticket_reference'),
    status: text('status').notNull().default('active'),
    grantedBy: text('granted_by').notNull(),
    expiresAt: integer('expires_at').notNull(),
    lastAccessAt: integer('last_access_at'),
    revokedBy: text('revoked_by'),
    revokedAt: integer('revoked_at'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    index('idx_support_grants_user_status').on(
      table.supportUserId,
      table.status,
      table.expiresAt,
    ),
    index('idx_support_grants_workspace_status').on(
      table.workspaceId,
      table.status,
      table.expiresAt,
    ),
  ],
);

export const invitations = sqliteTable(
  'invitations',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    email: text('email').notNull(),
    role: text('role').notNull(),
    status: text('status').notNull().default('pending'),
    invitedBy: text('invited_by').notNull(),
    expiresAt: integer('expires_at').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [
    index('idx_invitations_workspace_status').on(
      table.workspaceId,
      table.status,
    ),
  ],
);

export const leadErasureRequests = sqliteTable(
  'lead_erasure_requests',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    leadId: text('lead_id').notNull(),
    status: text('status').notNull().default('queued'),
    assetKeysJson: text('asset_keys_json').notNull().default('[]'),
    requestedBy: text('requested_by').notNull(),
    attempts: integer('attempts').notNull().default(0),
    lastError: text('last_error'),
    completedAt: integer('completed_at'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    index('idx_lead_erasure_workspace_status').on(
      table.workspaceId,
      table.status,
      table.createdAt,
    ),
    uniqueIndex('uidx_lead_erasure_workspace_lead').on(
      table.workspaceId,
      table.leadId,
    ),
  ],
);

export const auditEvents = sqliteTable(
  'audit_events',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    actorId: text('actor_id').notNull(),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id'),
    detailJson: text('detail_json'),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [
    index('idx_audit_events_workspace_created').on(
      table.workspaceId,
      table.createdAt,
    ),
  ],
);

export const accounts = sqliteTable(
  'accounts',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    name: text('name').notNull(),
    normalizedName: text('normalized_name').notNull(),
    domain: text('domain'),
    industry: text('industry'),
    status: text('status').notNull().default('active'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    uniqueIndex('uidx_accounts_workspace_normalized').on(
      table.workspaceId,
      table.normalizedName,
    ),
  ],
);

export const leads = sqliteTable(
  'leads',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    eventId: text('event_id').notNull(),
    accountId: text('account_id').references(() => accounts.id),
    clientCaptureId: text('client_capture_id'),
    ownerId: text('owner_id').notNull(),
    fullName: text('full_name').notNull(),
    company: text('company').notNull(),
    role: text('role'),
    email: text('email'),
    phone: text('phone'),
    source: text('source').notNull().default('manual'),
    reviewStatus: text('review_status').notNull().default('needs_review'),
    mergedIntoId: text('merged_into_id'),
    qualificationState: text('qualification_state')
      .notNull()
      .default('unqualified'),
    qualificationReason: text('qualification_reason'),
    qualificationUpdatedBy: text('qualification_updated_by'),
    qualificationUpdatedAt: integer('qualification_updated_at'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    index('idx_leads_workspace_created').on(table.workspaceId, table.createdAt),
    index('idx_leads_workspace_company').on(table.workspaceId, table.company),
    uniqueIndex('uidx_leads_workspace_client_capture').on(
      table.workspaceId,
      table.clientCaptureId,
    ),
  ],
);

export const accountStakeholders = sqliteTable(
  'account_stakeholders',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id),
    leadId: text('lead_id')
      .notNull()
      .references(() => leads.id),
    buyingRole: text('buying_role').notNull(),
    influenceLevel: text('influence_level').notNull().default('unknown'),
    notes: text('notes'),
    updatedBy: text('updated_by').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    uniqueIndex('uidx_account_stakeholder_lead').on(
      table.accountId,
      table.leadId,
    ),
  ],
);

export const leadCaptureAssets = sqliteTable(
  'lead_capture_assets',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    leadId: text('lead_id')
      .notNull()
      .references(() => leads.id),
    kind: text('kind').notNull(),
    originalName: text('original_name').notNull(),
    storageKey: text('storage_key').notNull(),
    contentType: text('content_type').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    processingStatus: text('processing_status').notNull().default('stored'),
    extractedJson: text('extracted_json'),
    createdBy: text('created_by').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [
    index('idx_lead_capture_assets_lead').on(table.workspaceId, table.leadId),
  ],
);

export const interactions = sqliteTable(
  'interactions',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    leadId: text('lead_id')
      .notNull()
      .references(() => leads.id),
    note: text('note').notNull(),
    source: text('source').notNull().default('typed_note'),
    occurredAt: integer('occurred_at').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [
    index('idx_interactions_lead').on(table.workspaceId, table.leadId),
  ],
);

export const tasks = sqliteTable(
  'tasks',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    leadId: text('lead_id')
      .notNull()
      .references(() => leads.id),
    ownerId: text('owner_id').notNull(),
    title: text('title').notNull(),
    dueDate: text('due_date'),
    status: text('status').notNull().default('open'),
    sourceInteractionId: text('source_interaction_id').references(
      () => interactions.id,
    ),
    sourceExtractionId: text('source_extraction_id'),
    sourceCommitmentKey: text('source_commitment_key'),
    reminderAt: integer('reminder_at'),
    completedBy: text('completed_by'),
    completedAt: integer('completed_at'),
    cancelledBy: text('cancelled_by'),
    cancelledAt: integer('cancelled_at'),
    cancellationReason: text('cancellation_reason'),
    version: integer('version').notNull().default(1),
    mutationToken: text('mutation_token'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    index('idx_tasks_workspace_status_due').on(
      table.workspaceId,
      table.status,
      table.dueDate,
    ),
    index('idx_tasks_workspace_reminder').on(
      table.workspaceId,
      table.status,
      table.reminderAt,
    ),
    uniqueIndex('uidx_tasks_source_commitment').on(
      table.workspaceId,
      table.sourceExtractionId,
      table.sourceCommitmentKey,
    ),
  ],
);

export const taskHistory = sqliteTable(
  'task_history',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    taskId: text('task_id')
      .notNull()
      .references(() => tasks.id),
    action: text('action').notNull(),
    fromStatus: text('from_status').notNull(),
    toStatus: text('to_status').notNull(),
    reason: text('reason'),
    reminderAt: integer('reminder_at'),
    version: integer('version').notNull(),
    actorId: text('actor_id').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [
    index('idx_task_history_task_created').on(
      table.workspaceId,
      table.taskId,
      table.createdAt,
    ),
  ],
);

export const meetings = sqliteTable(
  'meetings',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    eventId: text('event_id').notNull(),
    leadId: text('lead_id').references(() => leads.id),
    opportunityId: text('opportunity_id'),
    organizerId: text('organizer_id').notNull(),
    title: text('title').notNull(),
    startsAt: integer('starts_at').notNull(),
    endsAt: integer('ends_at').notNull(),
    timezone: text('timezone').notNull(),
    location: text('location'),
    agenda: text('agenda'),
    status: text('status').notNull().default('scheduled'),
    cancellationReason: text('cancellation_reason'),
    version: integer('version').notNull().default(1),
    mutationToken: text('mutation_token'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    index('idx_meetings_workspace_event_start').on(
      table.workspaceId,
      table.eventId,
      table.startsAt,
    ),
    index('idx_meetings_workspace_status_start').on(
      table.workspaceId,
      table.status,
      table.startsAt,
    ),
  ],
);

export const meetingParticipants = sqliteTable(
  'meeting_participants',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    meetingId: text('meeting_id')
      .notNull()
      .references(() => meetings.id),
    leadId: text('lead_id').references(() => leads.id),
    name: text('name'),
    email: text('email').notNull(),
    participantType: text('participant_type').notNull().default('external'),
    responseStatus: text('response_status').notNull().default('needs_action'),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [
    uniqueIndex('uidx_meeting_participants_email').on(
      table.meetingId,
      table.email,
    ),
    index('idx_meeting_participants_meeting').on(
      table.workspaceId,
      table.meetingId,
    ),
  ],
);

export const meetingHistory = sqliteTable(
  'meeting_history',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    meetingId: text('meeting_id')
      .notNull()
      .references(() => meetings.id),
    action: text('action').notNull(),
    fromStatus: text('from_status').notNull(),
    toStatus: text('to_status').notNull(),
    reason: text('reason'),
    version: integer('version').notNull(),
    actorId: text('actor_id').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [
    index('idx_meeting_history_meeting').on(
      table.workspaceId,
      table.meetingId,
      table.createdAt,
    ),
  ],
);

export const aiExtractions = sqliteTable(
  'ai_extractions',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    leadId: text('lead_id')
      .notNull()
      .references(() => leads.id),
    interactionId: text('interaction_id')
      .notNull()
      .references(() => interactions.id),
    status: text('status').notNull().default('processing'),
    model: text('model').notNull(),
    promptVersion: text('prompt_version').notNull(),
    resultJson: text('result_json'),
    errorCode: text('error_code'),
    createdAt: integer('created_at').notNull(),
    completedAt: integer('completed_at'),
    confirmedAt: integer('confirmed_at'),
    confirmedBy: text('confirmed_by'),
  },
  (table) => [
    index('idx_ai_extractions_lead_created').on(
      table.workspaceId,
      table.leadId,
      table.createdAt,
    ),
  ],
);

export const leadFacts = sqliteTable(
  'lead_facts',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    leadId: text('lead_id')
      .notNull()
      .references(() => leads.id),
    extractionId: text('extraction_id')
      .notNull()
      .references(() => aiExtractions.id),
    fieldKey: text('field_key').notNull(),
    label: text('label').notNull(),
    value: text('value').notNull(),
    confidenceBasisPoints: integer('confidence_basis_points').notNull(),
    evidence: text('evidence').notNull(),
    confirmedBy: text('confirmed_by').notNull(),
    confirmedAt: integer('confirmed_at').notNull(),
  },
  (table) => [
    uniqueIndex('uidx_lead_facts_extraction_field').on(
      table.extractionId,
      table.fieldKey,
    ),
  ],
);

export const qualificationScores = sqliteTable(
  'qualification_scores',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    leadId: text('lead_id')
      .notNull()
      .references(() => leads.id),
    extractionId: text('extraction_id')
      .notNull()
      .references(() => aiExtractions.id),
    score: integer('score').notNull(),
    rationale: text('rationale').notNull(),
    ruleResultsJson: text('rule_results_json').notNull().default('[]'),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [
    index('idx_qualification_scores_lead').on(
      table.workspaceId,
      table.leadId,
      table.createdAt,
    ),
    uniqueIndex('uidx_qualification_scores_extraction').on(table.extractionId),
  ],
);

export const communicationDrafts = sqliteTable(
  'communication_drafts',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    leadId: text('lead_id')
      .notNull()
      .references(() => leads.id),
    extractionId: text('extraction_id').references(() => aiExtractions.id),
    channel: text('channel').notNull(),
    recipient: text('recipient').notNull(),
    subject: text('subject'),
    body: text('body').notNull(),
    status: text('status').notNull().default('draft'),
    model: text('model').notNull(),
    createdBy: text('created_by').notNull(),
    approvedBy: text('approved_by'),
    createdAt: integer('created_at').notNull(),
    approvedAt: integer('approved_at'),
    version: integer('version').notNull().default(1),
    editedBy: text('edited_by'),
    updatedAt: integer('updated_at').notNull().default(0),
  },
  (table) => [
    index('idx_communication_drafts_lead').on(
      table.workspaceId,
      table.leadId,
      table.createdAt,
    ),
  ],
);

export const rfqs = sqliteTable(
  'rfqs',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    accountId: text('account_id').references(() => accounts.id),
    leadId: text('lead_id').references(() => leads.id),
    eventId: text('event_id'),
    title: text('title').notNull(),
    reference: text('reference'),
    requesterCompany: text('requester_company').notNull(),
    contactName: text('contact_name'),
    deliveryLocation: text('delivery_location'),
    submissionDeadline: text('submission_deadline'),
    status: text('status').notNull().default('received'),
    processingStatus: text('processing_status')
      .notNull()
      .default('manual_review'),
    ownerId: text('owner_id').notNull(),
    ownerDueAt: integer('owner_due_at'),
    version: integer('version').notNull().default(1),
    mutationToken: text('mutation_token'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    index('idx_rfqs_workspace_status_deadline').on(
      table.workspaceId,
      table.status,
      table.submissionDeadline,
    ),
  ],
);

export const rfqHistory = sqliteTable(
  'rfq_history',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    rfqId: text('rfq_id')
      .notNull()
      .references(() => rfqs.id),
    action: text('action').notNull(),
    fromStatus: text('from_status'),
    toStatus: text('to_status'),
    note: text('note'),
    version: integer('version').notNull(),
    mutationToken: text('mutation_token').notNull(),
    actorId: text('actor_id').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [
    uniqueIndex('uidx_rfq_history_mutation').on(
      table.workspaceId,
      table.mutationToken,
    ),
    index('idx_rfq_history_rfq').on(
      table.workspaceId,
      table.rfqId,
      table.createdAt,
    ),
  ],
);

export const rfqSubmissions = sqliteTable(
  'rfq_submissions',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    rfqId: text('rfq_id')
      .notNull()
      .references(() => rfqs.id),
    version: integer('version').notNull(),
    note: text('note'),
    status: text('status').notNull().default('submitted'),
    submittedBy: text('submitted_by').notNull(),
    submittedAt: integer('submitted_at').notNull(),
  },
  (table) => [
    uniqueIndex('uidx_rfq_submissions_version').on(
      table.workspaceId,
      table.rfqId,
      table.version,
    ),
    index('idx_rfq_submissions_rfq').on(
      table.workspaceId,
      table.rfqId,
      table.submittedAt,
    ),
  ],
);

export const rfqItems = sqliteTable(
  'rfq_items',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    rfqId: text('rfq_id')
      .notNull()
      .references(() => rfqs.id),
    product: text('product').notNull(),
    quantity: text('quantity'),
    specifications: text('specifications'),
    sourceEvidence: text('source_evidence'),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [index('idx_rfq_items_rfq').on(table.workspaceId, table.rfqId)],
);

export const rfqDocuments = sqliteTable(
  'rfq_documents',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    rfqId: text('rfq_id')
      .notNull()
      .references(() => rfqs.id),
    originalName: text('original_name').notNull(),
    storageKey: text('storage_key').notNull(),
    contentType: text('content_type').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    processingStatus: text('processing_status')
      .notNull()
      .default('stored_pending_extraction'),
    createdBy: text('created_by').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [
    index('idx_rfq_documents_rfq').on(table.workspaceId, table.rfqId),
  ],
);

export const rfqAiExtractions = sqliteTable(
  'rfq_ai_extractions',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    rfqId: text('rfq_id')
      .notNull()
      .references(() => rfqs.id),
    status: text('status').notNull().default('processing'),
    model: text('model').notNull(),
    resultJson: text('result_json'),
    errorCode: text('error_code'),
    createdBy: text('created_by').notNull(),
    createdAt: integer('created_at').notNull(),
    completedAt: integer('completed_at'),
    confirmedBy: text('confirmed_by'),
    confirmedAt: integer('confirmed_at'),
  },
  (table) => [
    index('idx_rfq_ai_extractions_rfq').on(
      table.workspaceId,
      table.rfqId,
      table.createdAt,
    ),
  ],
);

export const opportunities = sqliteTable(
  'opportunities',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    eventId: text('event_id'),
    leadId: text('lead_id').references(() => leads.id),
    accountId: text('account_id').references(() => accounts.id),
    company: text('company').notNull(),
    title: text('title').notNull(),
    stage: text('stage').notNull().default('qualified'),
    value: integer('value').notNull().default(0),
    currency: text('currency').notNull().default('INR'),
    probability: integer('probability').notNull().default(20),
    expectedCloseDate: text('expected_close_date'),
    lossReason: text('loss_reason'),
    closedAt: integer('closed_at'),
    version: integer('version').notNull().default(1),
    mutationToken: text('mutation_token'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    index('idx_opportunities_workspace_stage').on(
      table.workspaceId,
      table.stage,
    ),
    index('idx_opportunities_workspace_company').on(
      table.workspaceId,
      table.company,
    ),
  ],
);

export const opportunityContacts = sqliteTable(
  'opportunity_contacts',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    opportunityId: text('opportunity_id')
      .notNull()
      .references(() => opportunities.id),
    leadId: text('lead_id')
      .notNull()
      .references(() => leads.id),
    contactRole: text('contact_role'),
    isPrimary: integer('is_primary', { mode: 'boolean' })
      .notNull()
      .default(false),
    createdBy: text('created_by').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [
    uniqueIndex('uidx_opportunity_contacts_lead').on(
      table.workspaceId,
      table.opportunityId,
      table.leadId,
    ),
    index('idx_opportunity_contacts_opportunity').on(
      table.workspaceId,
      table.opportunityId,
    ),
  ],
);

export const opportunityHistory = sqliteTable(
  'opportunity_history',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    opportunityId: text('opportunity_id')
      .notNull()
      .references(() => opportunities.id),
    changeType: text('change_type').notNull(),
    fromStage: text('from_stage'),
    toStage: text('to_stage'),
    fromValue: integer('from_value'),
    toValue: integer('to_value'),
    reason: text('reason'),
    mutationToken: text('mutation_token').notNull(),
    changedBy: text('changed_by').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [
    uniqueIndex('uidx_opportunity_history_mutation').on(
      table.workspaceId,
      table.mutationToken,
    ),
    index('idx_opportunity_history_opportunity').on(
      table.workspaceId,
      table.opportunityId,
      table.createdAt,
    ),
  ],
);

export const quotations = sqliteTable(
  'quotations',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    eventId: text('event_id'),
    accountId: text('account_id').references(() => accounts.id),
    rfqId: text('rfq_id').references(() => rfqs.id),
    opportunityId: text('opportunity_id').references(() => opportunities.id),
    quoteNumber: text('quote_number').notNull(),
    customer: text('customer').notNull(),
    amount: integer('amount').notNull().default(0),
    currency: text('currency').notNull(),
    validUntil: text('valid_until'),
    status: text('status').notNull().default('draft'),
    version: integer('version').notNull().default(1),
    approvedBy: text('approved_by'),
    approvedAt: integer('approved_at'),
    sentAt: integer('sent_at'),
    mutationToken: text('mutation_token'),
    originalName: text('original_name'),
    storageKey: text('storage_key'),
    contentType: text('content_type'),
    sizeBytes: integer('size_bytes'),
    createdBy: text('created_by').notNull(),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    uniqueIndex('uidx_quotations_workspace_number').on(
      table.workspaceId,
      table.quoteNumber,
    ),
    index('idx_quotations_workspace_event').on(
      table.workspaceId,
      table.eventId,
    ),
    index('idx_quotations_workspace_status_valid').on(
      table.workspaceId,
      table.status,
      table.validUntil,
    ),
  ],
);

export const quotationRevisions = sqliteTable(
  'quotation_revisions',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    quotationId: text('quotation_id')
      .notNull()
      .references(() => quotations.id),
    version: integer('version').notNull(),
    amount: integer('amount').notNull(),
    validUntil: text('valid_until'),
    note: text('note'),
    originalName: text('original_name'),
    storageKey: text('storage_key'),
    contentType: text('content_type'),
    sizeBytes: integer('size_bytes'),
    createdBy: text('created_by').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [
    uniqueIndex('uidx_quotation_revisions_version').on(
      table.workspaceId,
      table.quotationId,
      table.version,
    ),
    index('idx_quotation_revisions_quote').on(
      table.workspaceId,
      table.quotationId,
      table.createdAt,
    ),
  ],
);

export const quotationHistory = sqliteTable(
  'quotation_history',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    quotationId: text('quotation_id')
      .notNull()
      .references(() => quotations.id),
    action: text('action').notNull(),
    fromStatus: text('from_status'),
    toStatus: text('to_status'),
    note: text('note'),
    version: integer('version').notNull(),
    mutationToken: text('mutation_token').notNull(),
    actorId: text('actor_id').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [
    uniqueIndex('uidx_quotation_history_mutation').on(
      table.workspaceId,
      table.mutationToken,
    ),
    index('idx_quotation_history_quote').on(
      table.workspaceId,
      table.quotationId,
      table.createdAt,
    ),
  ],
);

export const companyDocuments = sqliteTable(
  'company_documents',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    name: text('name').notNull(),
    kind: text('kind').notNull(),
    storageKey: text('storage_key'),
    status: text('status').notNull().default('pending_upload'),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [
    index('idx_company_documents_workspace').on(
      table.workspaceId,
      table.createdAt,
    ),
  ],
);

export const companyProfiles = sqliteTable('company_profiles', {
  workspaceId: text('workspace_id')
    .primaryKey()
    .references(() => workspaces.id),
  legalName: text('legal_name').notNull(),
  websiteUrl: text('website_url'),
  description: text('description'),
  targetIndustries: text('target_industries_json').notNull().default('[]'),
  targetGeographies: text('target_geographies_json').notNull().default('[]'),
  eventObjective: text('event_objective'),
  onboardingStep: integer('onboarding_step').notNull().default(1),
  updatedBy: text('updated_by').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const products = sqliteTable(
  'products',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    name: text('name').notNull(),
    kind: text('kind').notNull().default('product'),
    description: text('description'),
    buyerRoles: text('buyer_roles_json').notNull().default('[]'),
    painPoints: text('pain_points_json').notNull().default('[]'),
    status: text('status').notNull().default('active'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    index('idx_products_workspace_status').on(table.workspaceId, table.status),
  ],
);

export const idealCustomerProfiles = sqliteTable(
  'ideal_customer_profiles',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    name: text('name').notNull(),
    industries: text('industries_json').notNull().default('[]'),
    companySizes: text('company_sizes_json').notNull().default('[]'),
    geographies: text('geographies_json').notNull().default('[]'),
    buyerRoles: text('buyer_roles_json').notNull().default('[]'),
    mustHaveSignals: text('must_have_signals_json').notNull().default('[]'),
    disqualifiers: text('disqualifiers_json').notNull().default('[]'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    index('idx_icp_workspace').on(table.workspaceId, table.createdAt),
  ],
);

export const qualificationRules = sqliteTable(
  'qualification_rules',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    label: text('label').notNull(),
    field: text('field').notNull(),
    operator: text('operator').notNull(),
    expectedValue: text('expected_value').notNull(),
    weight: integer('weight').notNull().default(10),
    ruleType: text('rule_type').notNull().default('positive'),
    status: text('status').notNull().default('active'),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [
    index('idx_qualification_rules_workspace').on(
      table.workspaceId,
      table.status,
    ),
  ],
);

export const knowledgeSources = sqliteTable(
  'knowledge_sources',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    name: text('name').notNull(),
    sourceType: text('source_type').notNull(),
    sourceUrl: text('source_url'),
    storageKey: text('storage_key'),
    contentType: text('content_type'),
    sizeBytes: integer('size_bytes'),
    status: text('status').notNull().default('stored'),
    createdBy: text('created_by').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [
    index('idx_knowledge_sources_workspace').on(
      table.workspaceId,
      table.createdAt,
    ),
  ],
);

export const events = sqliteTable(
  'events',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    name: text('name').notNull(),
    venue: text('venue'),
    hall: text('hall'),
    booth: text('booth'),
    startsOn: text('starts_on').notNull(),
    endsOn: text('ends_on').notNull(),
    timezone: text('timezone').notNull(),
    budget: integer('budget').notNull().default(0),
    attributionWindowDays: integer('attribution_window_days')
      .notNull()
      .default(180),
    grossMarginBps: integer('gross_margin_bps').notNull().default(4000),
    objective: text('objective'),
    productsJson: text('products_json').notNull().default('[]'),
    targetAccountsJson: text('target_accounts_json').notNull().default('[]'),
    qualificationQuestionsJson: text('qualification_questions_json')
      .notNull()
      .default('[]'),
    teamMemberIdsJson: text('team_member_ids_json').notNull().default('[]'),
    leadRoutingRule: text('lead_routing_rule').notNull().default('capturer'),
    followupSlaHours: integer('followup_sla_hours').notNull().default(24),
    dailyLeadTarget: integer('daily_lead_target').notNull().default(25),
    badgeProvider: text('badge_provider'),
    qrCampaignCode: text('qr_campaign_code'),
    status: text('status').notNull().default('draft'),
    createdBy: text('created_by').notNull(),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    index('idx_events_workspace_status_dates').on(
      table.workspaceId,
      table.status,
      table.startsOn,
    ),
  ],
);

export const eventCostLines = sqliteTable(
  'event_cost_lines',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    eventId: text('event_id')
      .notNull()
      .references(() => events.id),
    category: text('category').notNull(),
    description: text('description').notNull(),
    vendor: text('vendor'),
    amount: integer('amount').notNull(),
    status: text('status').notNull().default('actual'),
    incurredOn: text('incurred_on'),
    version: integer('version').notNull().default(1),
    mutationToken: text('mutation_token'),
    voidedAt: integer('voided_at'),
    createdBy: text('created_by').notNull(),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    index('idx_event_cost_lines_event_status').on(
      table.eventId,
      table.status,
      table.incurredOn,
    ),
  ],
);

export const eventCostHistory = sqliteTable(
  'event_cost_history',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    eventId: text('event_id')
      .notNull()
      .references(() => events.id),
    costLineId: text('cost_line_id')
      .notNull()
      .references(() => eventCostLines.id),
    action: text('action').notNull(),
    fromVersion: integer('from_version'),
    toVersion: integer('to_version').notNull(),
    snapshotJson: text('snapshot_json').notNull(),
    mutationToken: text('mutation_token').notNull(),
    changedBy: text('changed_by').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [
    index('idx_event_cost_history_line').on(table.costLineId, table.createdAt),
    uniqueIndex('uidx_event_cost_history_mutation').on(
      table.costLineId,
      table.mutationToken,
    ),
  ],
);

export const eventMemberships = sqliteTable(
  'event_memberships',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    eventId: text('event_id')
      .notNull()
      .references(() => events.id),
    membershipId: text('membership_id')
      .notNull()
      .references(() => memberships.id),
    status: text('status').notNull().default('active'),
    createdBy: text('created_by').notNull(),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    uniqueIndex('uidx_event_memberships_event_member').on(
      table.eventId,
      table.membershipId,
    ),
    index('idx_event_memberships_member_status').on(
      table.workspaceId,
      table.membershipId,
      table.status,
    ),
    index('idx_event_memberships_event_status').on(
      table.workspaceId,
      table.eventId,
      table.status,
    ),
  ],
);

export const requestRateLimits = sqliteTable(
  'request_rate_limits',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    rateKey: text('rate_key').notNull(),
    windowStart: integer('window_start').notNull(),
    requestCount: integer('request_count').notNull().default(0),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    uniqueIndex('uidx_request_rate_limits_workspace_key').on(
      table.workspaceId,
      table.rateKey,
    ),
    index('idx_request_rate_limits_updated').on(table.updatedAt),
  ],
);

export const backgroundJobs = sqliteTable(
  'background_jobs',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    kind: text('kind').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    dedupeKey: text('dedupe_key').notNull(),
    payloadJson: text('payload_json').notNull().default('{}'),
    status: text('status').notNull().default('queued'),
    attempts: integer('attempts').notNull().default(0),
    maxAttempts: integer('max_attempts').notNull().default(5),
    availableAt: integer('available_at').notNull(),
    lockedAt: integer('locked_at'),
    lastError: text('last_error'),
    completedAt: integer('completed_at'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    uniqueIndex('uidx_background_jobs_dedupe').on(
      table.workspaceId,
      table.kind,
      table.dedupeKey,
    ),
    index('idx_background_jobs_due').on(table.status, table.availableAt),
  ],
);

export const jobRuns = sqliteTable(
  'job_runs',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').references(() => workspaces.id),
    status: text('status').notNull(),
    claimedCount: integer('claimed_count').notNull().default(0),
    completedCount: integer('completed_count').notNull().default(0),
    failedCount: integer('failed_count').notNull().default(0),
    deadCount: integer('dead_count').notNull().default(0),
    error: text('error'),
    startedAt: integer('started_at').notNull(),
    finishedAt: integer('finished_at'),
  },
  (table) => [index('idx_job_runs_started').on(table.startedAt)],
);

export const inAppNotifications = sqliteTable(
  'in_app_notifications',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    recipientUserId: text('recipient_user_id'),
    kind: text('kind').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    dedupeKey: text('dedupe_key').notNull(),
    readAt: integer('read_at'),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [
    uniqueIndex('uidx_in_app_notifications_dedupe').on(
      table.workspaceId,
      table.dedupeKey,
    ),
    index('idx_in_app_notifications_unread').on(
      table.workspaceId,
      table.readAt,
      table.createdAt,
    ),
  ],
);

export const operationalAlerts = sqliteTable(
  'operational_alerts',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    severity: text('severity').notNull(),
    code: text('code').notNull(),
    message: text('message').notNull(),
    dedupeKey: text('dedupe_key').notNull(),
    status: text('status').notNull().default('open'),
    acknowledgedBy: text('acknowledged_by'),
    acknowledgedAt: integer('acknowledged_at'),
    resolvedAt: integer('resolved_at'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    uniqueIndex('uidx_operational_alerts_dedupe').on(
      table.workspaceId,
      table.dedupeKey,
    ),
    index('idx_operational_alerts_status').on(
      table.workspaceId,
      table.status,
      table.createdAt,
    ),
  ],
);

export const workspaceDeletionRequests = sqliteTable(
  'workspace_deletion_requests',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    status: text('status').notNull().default('scheduled'),
    requestedBy: text('requested_by').notNull(),
    scheduledFor: integer('scheduled_for').notNull(),
    canceledBy: text('canceled_by'),
    canceledAt: integer('canceled_at'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    uniqueIndex('uidx_workspace_deletion_requests_workspace').on(
      table.workspaceId,
    ),
    index('idx_workspace_deletion_requests_status_due').on(
      table.status,
      table.scheduledFor,
    ),
  ],
);

export const leadConsents = sqliteTable(
  'lead_consents',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    leadId: text('lead_id')
      .notNull()
      .references(() => leads.id),
    purpose: text('purpose').notNull(),
    channel: text('channel').notNull(),
    status: text('status').notNull(),
    source: text('source').notNull(),
    capturedAt: integer('captured_at'),
    withdrawnAt: integer('withdrawn_at'),
    updatedBy: text('updated_by').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    uniqueIndex('uidx_lead_consents_scope').on(
      table.workspaceId,
      table.leadId,
      table.purpose,
      table.channel,
    ),
    index('idx_lead_consents_status').on(
      table.workspaceId,
      table.channel,
      table.status,
    ),
  ],
);

export const suppressionEntries = sqliteTable(
  'suppression_entries',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    channel: text('channel').notNull(),
    identifierHash: text('identifier_hash').notNull(),
    reason: text('reason').notNull(),
    sourceLeadId: text('source_lead_id').references(() => leads.id),
    status: text('status').notNull().default('active'),
    createdBy: text('created_by').notNull(),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    uniqueIndex('uidx_suppression_workspace_channel_identifier').on(
      table.workspaceId,
      table.channel,
      table.identifierHash,
    ),
    index('idx_suppression_workspace_status').on(
      table.workspaceId,
      table.status,
    ),
  ],
);

export const leadDuplicateSuggestions = sqliteTable(
  'lead_duplicate_suggestions',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    sourceLeadId: text('source_lead_id')
      .notNull()
      .references(() => leads.id),
    targetLeadId: text('target_lead_id')
      .notNull()
      .references(() => leads.id),
    status: text('status').notNull().default('pending'),
    confidenceBasisPoints: integer('confidence_basis_points').notNull(),
    reasonsJson: text('reasons_json').notNull(),
    resolvedBy: text('resolved_by'),
    resolvedAt: integer('resolved_at'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    uniqueIndex('uidx_lead_duplicate_pair').on(
      table.workspaceId,
      table.sourceLeadId,
      table.targetLeadId,
    ),
    index('idx_lead_duplicate_source_status').on(
      table.workspaceId,
      table.sourceLeadId,
      table.status,
    ),
  ],
);

export const leadMergeEvents = sqliteTable(
  'lead_merge_events',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    sourceLeadId: text('source_lead_id')
      .notNull()
      .references(() => leads.id),
    targetLeadId: text('target_lead_id')
      .notNull()
      .references(() => leads.id),
    status: text('status').notNull().default('merged'),
    snapshotJson: text('snapshot_json').notNull(),
    mergedBy: text('merged_by').notNull(),
    mergedAt: integer('merged_at').notNull(),
    revertedBy: text('reverted_by'),
    revertedAt: integer('reverted_at'),
  },
  (table) => [
    index('idx_lead_merge_source_status').on(
      table.workspaceId,
      table.sourceLeadId,
      table.status,
    ),
  ],
);

export const leadQualificationHistory = sqliteTable(
  'lead_qualification_history',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    leadId: text('lead_id')
      .notNull()
      .references(() => leads.id),
    state: text('state').notNull(),
    score: integer('score'),
    reason: text('reason').notNull(),
    source: text('source').notNull(),
    previousState: text('previous_state'),
    changedBy: text('changed_by').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [
    index('idx_lead_qualification_history_lead').on(
      table.workspaceId,
      table.leadId,
      table.createdAt,
    ),
  ],
);

export const leadAssignmentHistory = sqliteTable(
  'lead_assignment_history',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    leadId: text('lead_id')
      .notNull()
      .references(() => leads.id),
    previousOwnerId: text('previous_owner_id'),
    ownerId: text('owner_id').notNull(),
    reason: text('reason').notNull(),
    changedBy: text('changed_by').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [
    index('idx_lead_assignment_history_lead').on(
      table.workspaceId,
      table.leadId,
      table.createdAt,
    ),
  ],
);
