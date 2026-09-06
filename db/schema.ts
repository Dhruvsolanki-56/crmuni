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
