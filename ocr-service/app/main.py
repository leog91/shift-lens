from fastapi import FastAPI, HTTPException

from .paddle_engine import engine
from .payslip_parser import parse_payslip
from .preprocessing import preprocess_image, save_processed_preview
from .schemas import DailySheetResponse, ExtractionRequest, PayslipResponse, PreprocessResponse, RosterResponse
from .settings import settings
from .table_parser import parse_daily_rows, parse_roster_rows

app = FastAPI(title="ShiftLens OCR Service")


@app.get("/health")
def health():
    return {"service": settings.service_name, "ok": True, "ocrEngineAvailable": engine.available()}


@app.post("/preprocess", response_model=PreprocessResponse)
def preprocess(request: ExtractionRequest):
    try:
        _image, metadata = preprocess_image(request.filePath)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Image could not be decoded") from exc
    return metadata


@app.post("/extract/daily-sheet", response_model=DailySheetResponse)
def extract_daily_sheet(request: ExtractionRequest):
    try:
        image, metadata = preprocess_image(request.filePath)
        processed_path = save_processed_preview(image, request.filePath)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Image could not be decoded") from exc
    detections = engine.recognise(processed_path)
    rows = parse_daily_rows(detections, request.knownEmployees)
    unresolved = [reason for row in rows for reason in row.reviewReasons]
    if not rows:
        unresolved.append("No table rows detected; manual review required.")
    return DailySheetResponse(date=request.expectedDate, processedImagePath=processed_path, qualityWarnings=metadata["qualityWarnings"], detectedText=detections, rows=rows, unresolvedFields=unresolved)


@app.post("/extract/roster", response_model=RosterResponse)
def extract_roster(request: ExtractionRequest):
    try:
        _, metadata = preprocess_image(request.filePath)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Image could not be decoded") from exc
    # Roster colour bands can lose printed text after grayscale enhancement.
    # Paddle's own image handling retains those cells better than our preview.
    detections = engine.recognise(request.filePath)
    context = request.rosterContext or {}
    rows = parse_roster_rows(detections, request.knownEmployees, context.get("weekStarting", request.expectedDate or ""), context.get("closeTimes", {}))
    return RosterResponse(qualityWarnings=metadata["qualityWarnings"], rows=rows)


@app.post("/extract/payslip", response_model=PayslipResponse)
def extract_payslip(request: ExtractionRequest):
    try:
        image, _metadata = preprocess_image(request.filePath)
        processed_path = save_processed_preview(image, request.filePath)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Image could not be decoded") from exc
    detections = engine.recognise(processed_path)
    return parse_payslip(detections)
