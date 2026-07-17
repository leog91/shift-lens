import type { DocumentExtractor, ExtractionInput } from "./types";

export class ManualExtractor implements DocumentExtractor {
  readonly providerName = "manual";

  async extractDailySheet(input: ExtractionInput) {
    return { documentType: "daily_sheet" as const, date: input.expectedDate ?? null, providerName: this.providerName, qualityWarnings: ["Manual entry selected."], detectedText: [], rows: [], unresolvedFields: ["Manual rows must be entered and confirmed by the user."] };
  }

  async extractRoster() {
    return { documentType: "roster" as const, providerName: this.providerName, qualityWarnings: ["Manual roster entry selected."], rows: [] };
  }

  async extractPayslip() {
    return { documentType: "payslip" as const, providerName: this.providerName, employeeName: null, ordinaryPaidHours: null, sundayPaidHours: null, otherPaidHours: null, totalPaidHours: null, rawLabels: [], reviewRequired: true, reviewReasons: ["Manual payslip hours required."] };
  }
}
