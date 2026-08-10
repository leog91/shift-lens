import numpy as np
import cv2
import pytest
from pathlib import Path
from fastapi.testclient import TestClient

from app.main import app
from app.preprocessing import decode_image, preprocess_image, save_processed_preview
from app.quality import quality_warnings
from app.schemas import DailySheetResponse, TextDetection, BoundingBox
from app.table_parser import group_columns, group_rows, parse_daily_rows, parse_roster_rows
from app.payslip_parser import parse_hour_value, parse_payslip


client = TestClient(app)


def make_image(path: Path):
    image = np.full((1000, 1000, 3), 240, dtype=np.uint8)
    cv2.putText(image, "Ana 09:00 17:00 30", (50, 200), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 0), 2)
    cv2.imwrite(str(path), image)


def test_image_decoding(tmp_path):
    path = tmp_path / "sheet.jpg"
    make_image(path)
    assert decode_image(str(path)).shape[0] == 1000


def test_orientation_correction_metadata(tmp_path):
    path = tmp_path / "sheet.jpg"
    make_image(path)
    _, metadata = preprocess_image(str(path))
    assert metadata["rotated"] is False


def test_quality_warning_output():
    image = np.zeros((300, 300, 3), dtype=np.uint8)
    warnings = quality_warnings(image)
    assert "The photo may be low resolution." in warnings


def test_ocr_response_schema():
    response = DailySheetResponse(date="2026-07-10", qualityWarnings=[], detectedText=[], rows=[], unresolvedFields=[])
    assert response.documentType == "daily_sheet"


def test_row_grouping():
    detections = [TextDetection(text="Ana", boundingBox=BoundingBox(x=0, y=10, width=10, height=10)), TextDetection(text="Ben", boundingBox=BoundingBox(x=0, y=50, width=10, height=10))]
    assert len(group_rows(detections)) == 2


def test_column_grouping():
    row = [TextDetection(text="17", boundingBox=BoundingBox(x=80, y=10, width=10, height=10)), TextDetection(text="Ana", boundingBox=BoundingBox(x=0, y=10, width=10, height=10))]
    assert group_columns(row)[0].text == "Ana"


def test_fuzzy_employee_label_creates_partial_review_row():
    detections = [
        TextDetection(text="Start", boundingBox=BoundingBox(x=100, y=10, width=30, height=10)),
        TextDetection(text="Finish", boundingBox=BoundingBox(x=200, y=10, width=40, height=10)),
        TextDetection(text="Vctor", confidence=0.9, boundingBox=BoundingBox(x=10, y=50, width=40, height=10)),
        TextDetection(text="16:00", boundingBox=BoundingBox(x=100, y=50, width=35, height=10)),
    ]
    rows = parse_daily_rows(detections, [{"id": "victor", "displayName": "Victor", "aliases": []}])
    assert len(rows) == 1
    assert rows[0].matchedEmployeeId == "victor"
    assert rows[0].start.rawValue == "16:00"
    assert rows[0].finish is None
    assert "Employee name was matched approximately from OCR text." in rows[0].reviewReasons


def test_roster_parser_keeps_coloured_row_shifts_and_stock_assignment():
    detections = [
        TextDetection(text=day, boundingBox=BoundingBox(x=index * 100, y=10, width=30, height=10))
        for index, day in enumerate(["Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], start=2)
    ] + [
        TextDetection(text="Leo", boundingBox=BoundingBox(x=10, y=100, width=30, height=10)),
        TextDetection(text="9.30 - 3", boundingBox=BoundingBox(x=200, y=100, width=50, height=10)),
        TextDetection(text="5 - close", boundingBox=BoundingBox(x=400, y=100, width=50, height=10)),
        TextDetection(text="5 - close", boundingBox=BoundingBox(x=500, y=100, width=50, height=10)),
        TextDetection(text="5 - close", boundingBox=BoundingBox(x=600, y=100, width=50, height=10)),
        TextDetection(text="stock", boundingBox=BoundingBox(x=700, y=100, width=50, height=10)),
    ]
    rows = parse_roster_rows(detections, [{"id": "leo", "displayName": "Leo", "aliases": []}], "2026-07-27", {"thursday": "22:00", "friday": "23:00", "saturday": "23:00"})
    shifts = [(row.date, row.start.normalisedValue, row.finish.normalisedValue) for row in rows if row.start]
    assert shifts == [("2026-07-28", "09:30", "15:00"), ("2026-07-30", "17:00", "22:00"), ("2026-07-31", "17:00", "23:00"), ("2026-08-01", "17:00", "23:00")]
    assert rows[-1].assignmentType == "stock"


def test_roster_parser_reads_a_finish_after_midnight():
    detections = [
        TextDetection(text=day, boundingBox=BoundingBox(x=index * 100, y=10, width=30, height=10))
        for index, day in enumerate(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"])
    ] + [
        TextDetection(text="Leo", boundingBox=BoundingBox(x=10, y=100, width=30, height=10)),
        TextDetection(text="3 - 1", boundingBox=BoundingBox(x=100, y=100, width=50, height=10)),
        TextDetection(text="2 - 9", boundingBox=BoundingBox(x=200, y=100, width=50, height=10)),
    ]
    rows = parse_roster_rows(detections, [{"id": "leo", "displayName": "Leo", "aliases": []}], "2026-07-27", {})
    assert [(row.start.normalisedValue, row.finish.normalisedValue) for row in rows] == [("15:00", "01:00"), ("14:00", "21:00")]
    assert "This shift was read as finishing after midnight." in rows[0].reviewReasons


def test_high_resolution_sheet_still_finds_its_columns():
    # The same sheet at 4x: 100px text, so a cell sits 130px from its header
    # centre and 40px below the name. Both exceed the tolerances tuned for 25px
    # text, and the row would be read as having no times at all.
    detections = [
        TextDetection(text="Start", boundingBox=BoundingBox(x=400, y=40, width=120, height=100)),
        TextDetection(text="Finish", boundingBox=BoundingBox(x=1200, y=40, width=160, height=100)),
        TextDetection(text="Victor", confidence=0.9, boundingBox=BoundingBox(x=40, y=360, width=160, height=100)),
        TextDetection(text="16:00", boundingBox=BoundingBox(x=520, y=400, width=140, height=100)),
        TextDetection(text="23:30", boundingBox=BoundingBox(x=1320, y=400, width=140, height=100)),
    ]
    rows = parse_daily_rows(detections, [{"id": "victor", "displayName": "Victor", "aliases": []}])
    assert len(rows) == 1
    assert (rows[0].start.rawValue, rows[0].finish.rawValue) == ("16:00", "23:30")


def test_processed_previews_do_not_overwrite_each_other(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    first = tmp_path / "july" / "sheet.jpg"
    second = tmp_path / "august" / "sheet.jpg"
    for path in (first, second):
        path.parent.mkdir(parents=True, exist_ok=True)
        make_image(path)
    image, _ = preprocess_image(str(first))
    other, _ = preprocess_image(str(second))
    assert save_processed_preview(image, str(first)) != save_processed_preview(other, str(second))


def test_invalid_image_handling(tmp_path):
    path = tmp_path / "bad.jpg"
    path.write_text("not an image")
    response = client.post("/preprocess", json={"filePath": str(path), "mimeType": "image/jpeg"})
    assert response.status_code == 400


def test_sage_payslip_hour_rows_are_mapped():
    detections = [
        TextDetection(text="Basic", boundingBox=BoundingBox(x=10, y=10, width=50, height=10)),
        TextDetection(text="T", boundingBox=BoundingBox(x=90, y=10, width=10, height=10)),
        TextDetection(text="24.08", boundingBox=BoundingBox(x=130, y=10, width=40, height=10)),
        TextDetection(text="Sunday 10", boundingBox=BoundingBox(x=10, y=30, width=70, height=10)),
        TextDetection(text="T", boundingBox=BoundingBox(x=90, y=30, width=10, height=10)),
        TextDetection(text="4.00", boundingBox=BoundingBox(x=130, y=30, width=40, height=10)),
        TextDetection(text="PAYE", boundingBox=BoundingBox(x=10, y=80, width=40, height=10)),
        TextDetection(text="14.67", boundingBox=BoundingBox(x=130, y=80, width=40, height=10)),
    ]
    parsed = parse_payslip(detections)
    assert parsed.ordinaryPaidHours.rawValue == "24.08"
    assert parsed.ordinaryPaidHours.minutes is None
    assert parsed.sundayPaidHours.minutes == 240
    assert "PAYE" not in " ".join(parsed.rawLabels)
    assert parsed.reviewRequired is True


def test_payslip_hour_decimal_safety():
    assert parse_hour_value("7.50") == (450, None)
    assert parse_hour_value("7.30")[0] is None
