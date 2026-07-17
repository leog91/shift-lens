import type { DailySheetExtraction, PayslipExtraction, RosterExtraction } from "../schemas";

export interface ExtractionInput {
  filePath: string;
  mimeType: string;
  expectedDate?: string;
  knownEmployees?: Array<{ id: string; displayName: string; aliases: string[] }>;
  expectedColumnNames?: string[];
  rosterContext?: unknown;
}

export interface DocumentExtractor {
  readonly providerName: string;
  extractDailySheet(input: ExtractionInput): Promise<DailySheetExtraction>;
  extractRoster(input: ExtractionInput): Promise<RosterExtraction>;
  extractPayslip(input: ExtractionInput): Promise<PayslipExtraction>;
}
