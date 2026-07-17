import { DailySheetExtractionSchema, PayslipExtractionSchema, RosterExtractionSchema } from "../schemas";
import type { DocumentExtractor, ExtractionInput } from "./types";

export class PaddleOcrExtractor implements DocumentExtractor {
  readonly providerName = "paddle-ocr";

  constructor(private readonly serviceUrl = process.env.OCR_SERVICE_URL ?? "http://127.0.0.1:8001") {}

  async extractDailySheet(input: ExtractionInput) {
    const body = await this.post("/extract/daily-sheet", input);
    return DailySheetExtractionSchema.parse({ ...body, providerName: this.providerName });
  }

  async extractRoster(input: ExtractionInput) {
    const body = await this.post("/extract/roster", input);
    return RosterExtractionSchema.parse({ ...body, providerName: this.providerName });
  }

  async extractPayslip(input: ExtractionInput) {
    const body = await this.post("/extract/payslip", input);
    return PayslipExtractionSchema.parse({ ...body, providerName: this.providerName });
  }

  private async post(path: string, input: ExtractionInput): Promise<Record<string, unknown>> {
    let response: Response;
    try {
      response = await fetch(`${this.serviceUrl}${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input)
      });
    } catch {
      throw new Error(`Local OCR service is unavailable at ${this.serviceUrl}. Start it with bun run dev:ocr.`);
    }
    if (!response.ok) throw new Error(`OCR service failed: ${response.status}`);
    const body: unknown = await response.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("OCR service returned malformed JSON.");
    return body as Record<string, unknown>;
  }
}
