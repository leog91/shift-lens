from pydantic import BaseModel, Field
from typing import Literal


class BoundingBox(BaseModel):
    x: float
    y: float
    width: float
    height: float


class TextDetection(BaseModel):
    text: str
    confidence: float | None = Field(default=None, ge=0, le=1)
    boundingBox: BoundingBox | None = None


class ExtractedValue(BaseModel):
    rawValue: str | None
    normalisedValue: str | None = None
    minutes: int | None = None
    confidence: float | None = Field(default=None, ge=0, le=1)
    boundingBox: BoundingBox | None = None


class DailyRow(BaseModel):
    rowIndex: int
    rawEmployeeName: str | None
    matchedEmployeeId: str | None = None
    matchedEmployeeName: str | None = None
    employeeMatchConfidence: float | None = None
    start: ExtractedValue | None
    finish: ExtractedValue | None
    break_: ExtractedValue | None = Field(default=None, alias="break")
    reviewRequired: bool
    reviewReasons: list[str]


class ExtractionRequest(BaseModel):
    filePath: str
    mimeType: str
    expectedDate: str | None = None
    knownEmployees: list[dict] = []
    expectedColumnNames: list[str] = []
    rosterContext: dict | None = None


class DailySheetResponse(BaseModel):
    documentType: Literal["daily_sheet"] = "daily_sheet"
    date: str | None = None
    providerName: str = "paddle-ocr"
    processedImagePath: str | None = None
    qualityWarnings: list[str]
    detectedText: list[TextDetection]
    rows: list[DailyRow]
    unresolvedFields: list[str]


class RosterResponse(BaseModel):
    documentType: Literal["roster"] = "roster"
    providerName: str = "paddle-ocr"
    qualityWarnings: list[str]
    rows: list[DailyRow]


class PayslipResponse(BaseModel):
    documentType: Literal["payslip"] = "payslip"
    providerName: str = "paddle-ocr"
    employeeName: str | None = None
    ordinaryPaidHours: ExtractedValue | None = None
    sundayPaidHours: ExtractedValue | None = None
    otherPaidHours: ExtractedValue | None = None
    totalPaidHours: ExtractedValue | None = None
    rawLabels: list[str]
    reviewRequired: bool
    reviewReasons: list[str]


class PreprocessResponse(BaseModel):
    width: int
    height: int
    rotated: bool
    pageDetected: bool
    qualityWarnings: list[str]
