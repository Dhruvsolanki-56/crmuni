import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

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
