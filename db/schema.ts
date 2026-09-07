import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const workspaces = sqliteTable('workspaces', {
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
}, (table) => [uniqueIndex('uidx_workspaces_slug').on(table.slug)]);

export const memberships = sqliteTable('memberships', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id),
  userId: text('user_id').notNull(),
  email: text('email').notNull(),
  displayName: text('display_name'),
  role: text('role').notNull().default('salesperson'),
  status: text('status').notNull().default('active'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (table) => [
  index('idx_memberships_user_status').on(table.userId, table.status),
  index('idx_memberships_workspace_status').on(table.workspaceId, table.status),
  uniqueIndex('uidx_memberships_workspace_user').on(table.workspaceId, table.userId),
]);

export const invitations = sqliteTable('invitations', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id),
  email: text('email').notNull(),
  role: text('role').notNull(),
  status: text('status').notNull().default('pending'),
  invitedBy: text('invited_by').notNull(),
  expiresAt: integer('expires_at').notNull(),
  createdAt: integer('created_at').notNull(),
}, (table) => [index('idx_invitations_workspace_status').on(table.workspaceId, table.status)]);

export const auditEvents = sqliteTable('audit_events', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id),
  actorId: text('actor_id').notNull(),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id'),
  detailJson: text('detail_json'),
  createdAt: integer('created_at').notNull(),
}, (table) => [index('idx_audit_events_workspace_created').on(table.workspaceId, table.createdAt)]);

export const leads = sqliteTable('leads', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull(),
  eventId: text('event_id').notNull(),
  ownerId: text('owner_id').notNull(),
  fullName: text('full_name').notNull(),
  company: text('company').notNull(),
  role: text('role'),
  email: text('email'),
  phone: text('phone'),
  source: text('source').notNull().default('manual'),
  reviewStatus: text('review_status').notNull().default('needs_review'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (table) => [
  index('idx_leads_workspace_created').on(table.workspaceId, table.createdAt),
  index('idx_leads_workspace_company').on(table.workspaceId, table.company),
]);

export const interactions = sqliteTable('interactions', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull(),
  leadId: text('lead_id').notNull().references(() => leads.id),
  note: text('note').notNull(),
  source: text('source').notNull().default('typed_note'),
  occurredAt: integer('occurred_at').notNull(),
  createdAt: integer('created_at').notNull(),
}, (table) => [index('idx_interactions_lead').on(table.workspaceId, table.leadId)]);

export const tasks = sqliteTable('tasks', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull(),
  leadId: text('lead_id').notNull().references(() => leads.id),
  ownerId: text('owner_id').notNull(),
  title: text('title').notNull(),
  dueDate: text('due_date'),
  status: text('status').notNull().default('open'),
  sourceInteractionId: text('source_interaction_id').references(() => interactions.id),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (table) => [index('idx_tasks_workspace_status_due').on(table.workspaceId, table.status, table.dueDate)]);

export const aiExtractions = sqliteTable('ai_extractions', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull(),
  leadId: text('lead_id').notNull().references(() => leads.id),
  interactionId: text('interaction_id').notNull().references(() => interactions.id),
  status: text('status').notNull().default('processing'),
  model: text('model').notNull(),
  promptVersion: text('prompt_version').notNull(),
  resultJson: text('result_json'),
  errorCode: text('error_code'),
  createdAt: integer('created_at').notNull(),
  completedAt: integer('completed_at'),
  confirmedAt: integer('confirmed_at'),
  confirmedBy: text('confirmed_by'),
}, (table) => [
  index('idx_ai_extractions_lead_created').on(table.workspaceId, table.leadId, table.createdAt),
]);

export const opportunities = sqliteTable('opportunities', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull(),
  leadId: text('lead_id').references(() => leads.id),
  company: text('company').notNull(),
  title: text('title').notNull(),
  stage: text('stage').notNull().default('qualified'),
  value: integer('value').notNull().default(0),
  currency: text('currency').notNull().default('INR'),
  probability: integer('probability').notNull().default(20),
  expectedCloseDate: text('expected_close_date'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (table) => [
  index('idx_opportunities_workspace_stage').on(table.workspaceId, table.stage),
  index('idx_opportunities_workspace_company').on(table.workspaceId, table.company),
]);

export const companyDocuments = sqliteTable('company_documents', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull(),
  name: text('name').notNull(),
  kind: text('kind').notNull(),
  storageKey: text('storage_key'),
  status: text('status').notNull().default('pending_upload'),
  createdAt: integer('created_at').notNull(),
}, (table) => [index('idx_company_documents_workspace').on(table.workspaceId, table.createdAt)]);

export const companyProfiles = sqliteTable('company_profiles', {
  workspaceId: text('workspace_id').primaryKey().references(() => workspaces.id),
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

export const products = sqliteTable('products', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id),
  name: text('name').notNull(),
  kind: text('kind').notNull().default('product'),
  description: text('description'),
  buyerRoles: text('buyer_roles_json').notNull().default('[]'),
  painPoints: text('pain_points_json').notNull().default('[]'),
  status: text('status').notNull().default('active'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (table) => [index('idx_products_workspace_status').on(table.workspaceId, table.status)]);

export const idealCustomerProfiles = sqliteTable('ideal_customer_profiles', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id),
  name: text('name').notNull(),
  industries: text('industries_json').notNull().default('[]'),
  companySizes: text('company_sizes_json').notNull().default('[]'),
  geographies: text('geographies_json').notNull().default('[]'),
  buyerRoles: text('buyer_roles_json').notNull().default('[]'),
  mustHaveSignals: text('must_have_signals_json').notNull().default('[]'),
  disqualifiers: text('disqualifiers_json').notNull().default('[]'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (table) => [index('idx_icp_workspace').on(table.workspaceId, table.createdAt)]);

export const qualificationRules = sqliteTable('qualification_rules', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id),
  label: text('label').notNull(),
  field: text('field').notNull(),
  operator: text('operator').notNull(),
  expectedValue: text('expected_value').notNull(),
  weight: integer('weight').notNull().default(10),
  ruleType: text('rule_type').notNull().default('positive'),
  status: text('status').notNull().default('active'),
  createdAt: integer('created_at').notNull(),
}, (table) => [index('idx_qualification_rules_workspace').on(table.workspaceId, table.status)]);

export const knowledgeSources = sqliteTable('knowledge_sources', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id),
  name: text('name').notNull(),
  sourceType: text('source_type').notNull(),
  sourceUrl: text('source_url'),
  storageKey: text('storage_key'),
  contentType: text('content_type'),
  sizeBytes: integer('size_bytes'),
  status: text('status').notNull().default('stored'),
  createdBy: text('created_by').notNull(),
  createdAt: integer('created_at').notNull(),
}, (table) => [index('idx_knowledge_sources_workspace').on(table.workspaceId, table.createdAt)]);
