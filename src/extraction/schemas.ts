import { z } from "zod";

export const BoundingBoxSchema = z.object({ x: z.number(), y: z.number(), width: z.number(), height: z.number() });

export const ExtractedValueSchema = z.object({
  rawValue: z.string().nullable(),
  normalisedValue: z.string().nullable().optional(),
  minutes: z.number().int().nullable().optional(),
  confidence: z.number().min(0).max(1).nullable(),
  boundingBox: BoundingBoxSchema.nullable().optional(),
  alternativeInterpretations: z.array(z.string()).optional()
});

export const DailySheetRowSchema = z.object({
  rowIndex: z.number().int(),
  rawEmployeeName: z.string().nullable(),
  matchedEmployeeId: z.string().nullable().optional(),
  matchedEmployeeName: z.string().nullable().optional(),
  employeeMatchConfidence: z.number().min(0).max(1).nullable().optional(),
  start: ExtractedValueSchema.nullable(),
  finish: ExtractedValueSchema.nullable(),
  break: ExtractedValueSchema.nullable(),
  reviewRequired: z.boolean(),
  reviewReasons: z.array(z.string())
});

export const DailySheetExtractionSchema = z.object({
  documentType: z.literal("daily_sheet"),
  date: z.string().nullable(),
  providerName: z.string(),
  processedImagePath: z.string().nullable().optional(),
  qualityWarnings: z.array(z.string()),
  detectedText: z.array(z.object({ text: z.string(), confidence: z.number().nullable(), boundingBox: BoundingBoxSchema.nullable() })).default([]),
  rows: z.array(DailySheetRowSchema),
  unresolvedFields: z.array(z.string()).default([])
});

export const RosterExtractionSchema = z.object({
  documentType: z.literal("roster"),
  providerName: z.string(),
  qualityWarnings: z.array(z.string()),
  rows: z.array(DailySheetRowSchema)
});

export const PayslipExtractionSchema = z.object({
  documentType: z.literal("payslip"),
  providerName: z.string(),
  employeeName: z.string().nullable(),
  ordinaryPaidHours: ExtractedValueSchema.nullable(),
  sundayPaidHours: ExtractedValueSchema.nullable(),
  otherPaidHours: ExtractedValueSchema.nullable(),
  totalPaidHours: ExtractedValueSchema.nullable(),
  rawLabels: z.array(z.string()).default([]),
  reviewRequired: z.boolean(),
  reviewReasons: z.array(z.string())
});

export type DailySheetExtraction = z.infer<typeof DailySheetExtractionSchema>;
export type RosterExtraction = z.infer<typeof RosterExtractionSchema>;
export type PayslipExtraction = z.infer<typeof PayslipExtractionSchema>;
