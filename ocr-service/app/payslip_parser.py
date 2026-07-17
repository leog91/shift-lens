import re

from .schemas import ExtractedValue, PayslipResponse, TextDetection
from .table_parser import group_columns, group_rows

HOUR_RE = re.compile(r"^\d+(?::\d{2}|\.\d{1,2})?$")


def parse_hour_value(raw: str) -> tuple[int | None, str | None]:
    value = raw.strip()
    if re.match(r"^\d{1,3}:\d{2}$", value):
        hours, minutes = [int(part) for part in value.split(":")]
        return hours * 60 + minutes, None
    if re.match(r"^\d+$", value):
        return int(value) * 60, None
    if re.match(r"^\d+\.00$", value):
        return int(float(value)) * 60, None
    if re.match(r"^\d+\.(25|50|5|75)$", value):
        return round(float(value) * 60), None
    if re.match(r"^\d+\.\d{2}$", value):
        return None, "Ambiguous decimal payslip hours; confirm whether this is decimal hours or hours/minutes."
    return None, "Unreadable payslip hour value."


def _row_text(row: list[TextDetection]) -> str:
    return " ".join(item.text for item in group_columns(row))


def _first_hour_token(row: list[TextDetection]) -> TextDetection | None:
    # Sage payment rows are usually Description, T/N, Hours, Value. Pick the first numeric-looking token after the label.
    for item in group_columns(row)[1:]:
        if HOUR_RE.match(item.text.strip()):
            return item
    return None


def parse_payslip(detections: list[TextDetection]) -> PayslipResponse:
    ordinary: ExtractedValue | None = None
    sunday: ExtractedValue | None = None
    other: ExtractedValue | None = None
    labels: list[str] = []
    review_reasons: list[str] = []

    for row in group_rows(detections):
        text = _row_text(row)
        lower = text.lower()
        token = _first_hour_token(row)
        if token is None:
            continue
        minutes, reason = parse_hour_value(token.text)
        extracted = ExtractedValue(rawValue=token.text, minutes=minutes, confidence=token.confidence, boundingBox=token.boundingBox)
        if reason:
            review_reasons.append(f"{text}: {reason}")
        if "basic" in lower or "ordinary" in lower or "normal" in lower:
            ordinary = extracted
            labels.append(text)
        elif "sunday" in lower:
            sunday = extracted
            labels.append(text)
        elif "hour" in lower:
            other = extracted
            labels.append(text)

    if ordinary is None and sunday is None and other is None:
        review_reasons.append("No paid-hour rows detected; manual label mapping required.")

    return PayslipResponse(
        ordinaryPaidHours=ordinary,
        sundayPaidHours=sunday,
        otherPaidHours=other,
        totalPaidHours=None,
        rawLabels=labels,
        reviewRequired=bool(review_reasons),
        reviewReasons=review_reasons,
    )
