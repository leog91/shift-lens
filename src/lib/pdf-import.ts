import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join } from "node:path";
import { z } from "zod";
import { requireLocalDataMode } from "./data-mode";
import { localProfilePath } from "./local-profile";
import { manualReviewPhotoRoot } from "./photo-inbox";

const execute = promisify(execFile);
const Result = z.object({ directory: z.string(), pageCount: z.number().int().positive(), sha256: z.string() });

export async function importPdf(filePath: string) {
  requireLocalDataMode();
  const python = process.env.SHIFT_LENS_PYTHON ?? join(process.cwd(), "ocr-service/.venv/bin/python");
  try {
    const { stdout } = await execute(python, [join(process.cwd(), "ocr-service/app/pdf_import.py"), filePath, localProfilePath(manualReviewPhotoRoot)], { timeout: 600_000, maxBuffer: 1024 * 1024 });
    return Result.parse(JSON.parse(stdout));
  } catch (error) {
    throw new Error("PDF import failed. Check that the PDF is readable, under 100 MB and 500 pages, and install the OCR service requirements.", { cause: error });
  }
}
