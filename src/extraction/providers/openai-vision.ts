import { DailySheetExtractionSchema, PayslipExtractionSchema, RosterExtractionSchema } from "../schemas";
import type { DocumentExtractor, ExtractionInput } from "./types";

export function openAiVisionAvailable() {
  return Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_VISION_MODEL);
}

export class OpenAiVisionExtractor implements DocumentExtractor {
  readonly providerName = "openai-vision";

  constructor() {
    if (!openAiVisionAvailable()) throw new Error("OpenAI Vision requires OPENAI_API_KEY and OPENAI_VISION_MODEL.");
  }

  async extractDailySheet(input: ExtractionInput) {
    return DailySheetExtractionSchema.parse(await this.notImplemented(input, "daily_sheet"));
  }

  async extractRoster(input: ExtractionInput) {
    return RosterExtractionSchema.parse(await this.notImplemented(input, "roster"));
  }

  async extractPayslip(input: ExtractionInput) {
    return PayslipExtractionSchema.parse(await this.notImplemented(input, "payslip"));
  }

  private async notImplemented(_input: ExtractionInput, documentType: "daily_sheet" | "roster" | "payslip") {
    throw new Error(`${documentType} OpenAI adapter is structured but intentionally disabled until API call wiring is added.`);
  }
}
