import { z } from "zod";

export const ActualSheetSchema = z.object({
  week: z.string(),
  documents: z.array(z.object({
    filename: z.string(),
    date: z.string(),
    rows: z.array(z.object({
      rawEmployeeName: z.string().nullable(),
      employeeName: z.string().nullable(),
      startTime: z.string().nullable(),
      finishTime: z.string().nullable(),
      breakMinutes: z.number().int().nullable(),
      reviewRequired: z.boolean(),
      uncertainFields: z.array(z.string()),
      reviewReason: z.string().nullable()
    }))
  }))
});

export const PayrollSchema = z.object({
  week: z.string(),
  employees: z.array(z.object({
    employeeName: z.string().nullable(),
    ordinaryPaidMinutes: z.number().int().nullable(),
    sundayPaidMinutes: z.number().int().nullable(),
    otherPaidMinutes: z.number().int().nullable(),
    totalPaidMinutes: z.number().int().nullable(),
    reviewRequired: z.boolean(),
    reviewReason: z.string().nullable()
  }))
});

export type ActualSheet = z.infer<typeof ActualSheetSchema>;
export type Payroll = z.infer<typeof PayrollSchema>;
