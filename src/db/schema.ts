import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
};

export const companies = sqliteTable("companies", {
  id: text("id").primaryKey(),
  businessName: text("business_name").notNull(),
  schemaVersion: integer("schema_version").notNull().default(1)
});

export const employees = sqliteTable("employees", {
  id: text("id").primaryKey(),
  displayName: text("display_name").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  ...timestamps
});

export const employeeAliases = sqliteTable("employee_aliases", {
  id: text("id").primaryKey(),
  employeeId: text("employee_id").notNull().references(() => employees.id),
  alias: text("alias").notNull(),
  createdAt: text("created_at").notNull()
});

export const weeks = sqliteTable("weeks", {
  id: text("id").primaryKey(),
  weekStarting: text("week_starting").notNull(),
  notes: text("notes"),
  status: text("status", { enum: ["open", "needs_review", "reconciled", "archived"] }).notNull().default("open"),
  ...timestamps
});

export const documents = sqliteTable("documents", {
  id: text("id").primaryKey(),
  weekId: text("week_id").notNull().references(() => weeks.id),
  documentType: text("document_type", { enum: ["daily_sheet", "roster", "payslip"] }).notNull(),
  documentDate: text("document_date"),
  originalFilename: text("original_filename").notNull(),
  originalPath: text("original_path").notNull(),
  processedPath: text("processed_path"),
  mimeType: text("mime_type").notNull(),
  extractionProvider: text("extraction_provider"),
  extractionStatus: text("extraction_status", { enum: ["uploaded", "processing", "extracted", "needs_review", "confirmed", "failed"] }).notNull().default("uploaded"),
  qualityWarningsJson: text("quality_warnings_json").notNull().default("[]"),
  ...timestamps
});

export const extractionRuns = sqliteTable("extraction_runs", {
  id: text("id").primaryKey(),
  documentId: text("document_id").notNull().references(() => documents.id),
  provider: text("provider").notNull(),
  providerVersion: text("provider_version").notNull(),
  startedAt: text("started_at").notNull(),
  completedAt: text("completed_at"),
  status: text("status").notNull(),
  rawOutputJson: text("raw_output_json"),
  errorMessage: text("error_message")
});

export const extractedFields = sqliteTable("extracted_fields", {
  id: text("id").primaryKey(),
  extractionRunId: text("extraction_run_id").notNull().references(() => extractionRuns.id),
  documentId: text("document_id").notNull().references(() => documents.id),
  rowIndex: integer("row_index"),
  fieldType: text("field_type", { enum: ["employee_name", "date", "start_time", "finish_time", "break", "ordinary_paid_hours", "sunday_paid_hours", "other_paid_hours", "total_paid_hours"] }).notNull(),
  rawValue: text("raw_value"),
  normalisedValue: text("normalised_value"),
  confidence: real("confidence"),
  boundingBoxJson: text("bounding_box_json"),
  reviewRequired: integer("review_required", { mode: "boolean" }).notNull().default(false),
  reviewReason: text("review_reason"),
  createdAt: text("created_at").notNull()
});

export const shifts = sqliteTable("shifts", {
  id: text("id").primaryKey(),
  employeeId: text("employee_id").notNull().references(() => employees.id),
  weekId: text("week_id").notNull().references(() => weeks.id),
  documentId: text("document_id").references(() => documents.id),
  date: text("date").notNull(),
  source: text("source", { enum: ["actual", "roster"] }).notNull(),
  startTime: text("start_time"),
  finishTime: text("finish_time"),
  breakMinutes: integer("break_minutes"),
  status: text("status", { enum: ["extracted", "confirmed", "uncertain", "manually_entered"] }).notNull(),
  notes: text("notes"),
  ...timestamps
});

export const payrollEntries = sqliteTable("payroll_entries", {
  id: text("id").primaryKey(),
  employeeId: text("employee_id").notNull().references(() => employees.id),
  weekId: text("week_id").notNull().references(() => weeks.id),
  documentId: text("document_id").references(() => documents.id),
  ordinaryPaidMinutes: integer("ordinary_paid_minutes").notNull().default(0),
  sundayPaidMinutes: integer("sunday_paid_minutes").notNull().default(0),
  otherPaidMinutes: integer("other_paid_minutes").notNull().default(0),
  displayedTotalPaidMinutes: integer("displayed_total_paid_minutes"),
  status: text("status").notNull().default("extracted"),
  notes: text("notes"),
  ...timestamps
});

export const reviewItems = sqliteTable("review_items", {
  id: text("id").primaryKey(),
  weekId: text("week_id").notNull().references(() => weeks.id),
  documentId: text("document_id").references(() => documents.id),
  extractedFieldId: text("extracted_field_id").references(() => extractedFields.id),
  reviewType: text("review_type").notNull(),
  status: text("status", { enum: ["open", "confirmed", "corrected", "unreadable", "ignored"] }).notNull().default("open"),
  message: text("message").notNull(),
  proposedValue: text("proposed_value"),
  confirmedValue: text("confirmed_value"),
  resolvedAt: text("resolved_at"),
  createdAt: text("created_at").notNull()
});

export const corrections = sqliteTable("corrections", {
  id: text("id").primaryKey(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  fieldName: text("field_name").notNull(),
  previousValue: text("previous_value"),
  correctedValue: text("corrected_value"),
  reason: text("reason"),
  createdAt: text("created_at").notNull()
});
