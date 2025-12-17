import {
  pgTable,
  text,
  varchar,
  integer,
  timestamp,
  uuid,
  index,
  boolean,
  pgEnum,
  serial,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ============================================
// ENUMS
// ============================================

export const userStatusEnum = pgEnum("user_status", ["PENDING", "APPROVED", "REJECTED"]);
export const templateVisibilityEnum = pgEnum("template_visibility", ["public", "division", "department", "custom"]);
export const taskStatusEnum = pgEnum("task_status", ["pending", "processing", "completed", "failed"]);
export const transcriptionStatusEnum = pgEnum("transcription_status", ["pending", "processing", "completed", "failed"]);

// ============================================
// USERS TABLE (synced from portal API)
// ============================================

export const users = pgTable(
  "users",
  {
    id: varchar("id").primaryKey(), // Keycloak sub
    npk: varchar("npk", { length: 50 }),
    email: varchar("email", { length: 255 }).notNull().unique(),
    name: varchar("name", { length: 255 }),
    status: userStatusEnum("status").default("PENDING").notNull(),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_users_email").on(table.email),
    index("idx_users_npk").on(table.npk),
  ]
);

// ============================================
// TEMPLATES TABLE
// ============================================

export const templates = pgTable(
  "templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    markdown: text("markdown").notNull(),
    rawText: text("raw_text"), // Original extracted text before AI conversion
    fileName: varchar("file_name", { length: 255 }), // Original uploaded file name
    
    // Visibility settings
    visibility: templateVisibilityEnum("visibility").notNull().default("public"),
    divisionId: integer("division_id"), // For division visibility
    departmentId: integer("department_id"), // For department visibility
    
    // System template flag (cannot be deleted by users)
    isSystem: boolean("is_system").default(false).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    
    // Ownership
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    
    // Audit fields
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_templates_user_id").on(table.userId),
    index("idx_templates_visibility").on(table.visibility),
    index("idx_templates_division_id").on(table.divisionId),
    index("idx_templates_department_id").on(table.departmentId),
  ]
);

// Junction table for custom visibility (specific users)
export const templateUsers = pgTable(
  "template_users",
  {
    id: serial("id").primaryKey(),
    templateId: uuid("template_id")
      .notNull()
      .references(() => templates.id, { onDelete: "cascade" }),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_template_users_template_id").on(table.templateId),
    index("idx_template_users_user_id").on(table.userId),
  ]
);

// Junction table for role-based access (custom visibility)
export const templateRoles = pgTable(
  "template_roles",
  {
    id: serial("id").primaryKey(),
    templateId: uuid("template_id")
      .notNull()
      .references(() => templates.id, { onDelete: "cascade" }),
    roleId: integer("role_id").notNull(), // References role in portal
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_template_roles_template_id").on(table.templateId),
    index("idx_template_roles_role_id").on(table.roleId),
  ]
);

// ============================================
// TASKS TABLE (Background Processing)
// ============================================

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    
    // Task info
    name: varchar("name", { length: 255 }).notNull(),
    status: taskStatusEnum("status").default("pending").notNull(),
    
    // Input data
    transcript: text("transcript").notNull(),
    templateId: uuid("template_id").references(() => templates.id, { onDelete: "set null" }),
    
    // Output data
    result: text("result"), // Generated document (markdown)
    error: text("error"), // Error message if failed
    
    // Progress tracking
    progress: integer("progress").default(0), // 0-100
    progressMessage: varchar("progress_message", { length: 255 }),
    
    // Ownership
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    
    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
  },
  (table) => [
    index("idx_tasks_user_id").on(table.userId),
    index("idx_tasks_status").on(table.status),
    index("idx_tasks_created_at").on(table.createdAt),
  ]
);

// ============================================
// TRANSCRIPTION TASKS TABLE (Audio Transcription)
// ============================================

export const transcriptionTasks = pgTable(
  "transcription_tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    
    // Task info
    fileName: varchar("file_name", { length: 255 }).notNull(),
    fileSize: integer("file_size").notNull(),
    status: transcriptionStatusEnum("status").default("pending").notNull(),
    
    // Google Cloud operation tracking
    operationName: varchar("operation_name", { length: 500 }), // GCS operation name for polling
    gcsUri: varchar("gcs_uri", { length: 500 }), // GCS URI if uploaded to cloud storage
    language: varchar("language", { length: 10 }).default("id-ID").notNull(),
    
    // Output data
    result: text("result"), // Transcribed text with speaker diarization
    wordCount: integer("word_count"),
    error: text("error"), // Error message if failed
    
    // Ownership
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    
    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
  },
  (table) => [
    index("idx_transcription_tasks_user_id").on(table.userId),
    index("idx_transcription_tasks_status").on(table.status),
    index("idx_transcription_tasks_created_at").on(table.createdAt),
  ]
);

// ============================================
// RELATIONS
// ============================================

export const usersRelations = relations(users, ({ many }) => ({
  templates: many(templates),
  templateAccess: many(templateUsers),
  tasks: many(tasks),
  transcriptionTasks: many(transcriptionTasks),
}));

export const templatesRelations = relations(templates, ({ one, many }) => ({
  owner: one(users, {
    fields: [templates.userId],
    references: [users.id],
  }),
  allowedUsers: many(templateUsers),
  allowedRoles: many(templateRoles),
  tasks: many(tasks),
}));

export const templateUsersRelations = relations(templateUsers, ({ one }) => ({
  template: one(templates, {
    fields: [templateUsers.templateId],
    references: [templates.id],
  }),
  user: one(users, {
    fields: [templateUsers.userId],
    references: [users.id],
  }),
}));

export const templateRolesRelations = relations(templateRoles, ({ one }) => ({
  template: one(templates, {
    fields: [templateRoles.templateId],
    references: [templates.id],
  }),
}));

export const tasksRelations = relations(tasks, ({ one }) => ({
  user: one(users, {
    fields: [tasks.userId],
    references: [users.id],
  }),
  template: one(templates, {
    fields: [tasks.templateId],
    references: [templates.id],
  }),
}));

export const transcriptionTasksRelations = relations(transcriptionTasks, ({ one }) => ({
  user: one(users, {
    fields: [transcriptionTasks.userId],
    references: [users.id],
  }),
}));

// ============================================
// TYPE EXPORTS
// ============================================

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Template = typeof templates.$inferSelect;
export type NewTemplate = typeof templates.$inferInsert;
export type TemplateUser = typeof templateUsers.$inferSelect;
export type NewTemplateUser = typeof templateUsers.$inferInsert;
export type TemplateRole = typeof templateRoles.$inferSelect;
export type NewTemplateRole = typeof templateRoles.$inferInsert;
export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
export type TranscriptionTask = typeof transcriptionTasks.$inferSelect;
export type NewTranscriptionTask = typeof transcriptionTasks.$inferInsert;
