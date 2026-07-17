import re
from difflib import SequenceMatcher

from .schemas import DailyRow, ExtractedValue, TextDetection


def looks_like_time(value: str) -> bool:
    return bool(re.match(r"^\d{1,2}[:\.]\d{2}$", value.strip()))


def cluster_time_columns(detections: list[TextDetection], exclude_texts: set[str]) -> tuple[float | None, float | None]:
    """Infer Start and Finish column centres by clustering time-like cells horizontally."""
    time_cells = [
        d for d in detections
        if d.boundingBox
        and looks_like_time(d.text)
        and normalise_name(d.text) not in exclude_texts
    ]
    if len(time_cells) < 2:
        return None, None
    xs = sorted(detection_x(d) for d in time_cells)
    max_gap = 0
    split_idx = 0
    for i in range(1, len(xs)):
        gap = xs[i] - xs[i - 1]
        if gap > max_gap:
            max_gap = gap
            split_idx = i
    if max_gap < 30 or split_idx == 0 or split_idx == len(xs):
        return None, None
    start_x = sum(xs[:split_idx]) / split_idx
    finish_x = sum(xs[split_idx:]) / (len(xs) - split_idx)
    return start_x, finish_x


def assign_time_by_cluster(row: list[TextDetection], start_x: float, finish_x: float) -> tuple[ExtractedValue | None, ExtractedValue | None]:
    header_labels = {"name", "start", "ta", "finish", "break", "stafffood"}
    cells = [
        c for c in row
        if c.boundingBox
        and looks_like_time(c.text)
        and normalise_name(c.text) not in header_labels
    ]
    if not cells:
        return None, None
    cells.sort(key=lambda c: detection_x(c))
    if len(cells) == 1:
        item = cells[0]
        value = ExtractedValue(rawValue=item.text, confidence=item.confidence, boundingBox=item.boundingBox)
        if abs(detection_x(item) - start_x) <= abs(detection_x(item) - finish_x):
            return value, None
        return None, value
    # Leftmost time is start, rightmost is finish.
    start_item = cells[0]
    finish_item = cells[-1]
    start = ExtractedValue(rawValue=start_item.text, confidence=start_item.confidence, boundingBox=start_item.boundingBox)
    finish = ExtractedValue(rawValue=finish_item.text, confidence=finish_item.confidence, boundingBox=finish_item.boundingBox)
    return start, finish


def group_rows(detections: list[TextDetection], tolerance: float = 18) -> list[list[TextDetection]]:
    sorted_items = sorted([d for d in detections if d.boundingBox], key=lambda d: d.boundingBox.y if d.boundingBox else 0)
    rows: list[list[TextDetection]] = []
    for item in sorted_items:
        y = item.boundingBox.y if item.boundingBox else 0
        if rows and rows[-1][0].boundingBox and abs(rows[-1][0].boundingBox.y - y) <= tolerance:
            rows[-1].append(item)
        else:
            rows.append([item])
    return rows


def group_columns(row: list[TextDetection]) -> list[TextDetection]:
    return sorted(row, key=lambda d: d.boundingBox.x if d.boundingBox else 0)


def normalise_name(value: str) -> str:
    return re.sub(r"[^a-z]", "", value.lower())


def detection_x(item: TextDetection) -> float:
    return item.boundingBox.x + item.boundingBox.width / 2 if item.boundingBox else 0


def detection_y(item: TextDetection) -> float:
    return item.boundingBox.y + item.boundingBox.height / 2 if item.boundingBox else 0


def find_header_x(detections: list[TextDetection], label: str) -> float | None:
    target = normalise_name(label)
    for item in detections:
        if normalise_name(item.text) == target:
            return detection_x(item)
    return None


def match_employee_name(value: str, matches: dict[str, dict]) -> tuple[dict | None, bool]:
    normalised = normalise_name(value)
    exact = matches.get(normalised)
    if exact:
        return exact, False
    # Printed labels can lose one character during OCR. Only use a close match for
    # longer names so a short, unrelated cell cannot create a row for an employee.
    if len(normalised) < 4:
        return None, False
    closest_name, similarity = max(
        ((name, SequenceMatcher(None, normalised, name).ratio()) for name in matches),
        key=lambda item: item[1],
        default=("", 0.0),
    )
    if similarity < 0.82:
        return None, False
    return matches[closest_name], True


def nearest_cell(row: list[TextDetection], x: float | None) -> ExtractedValue | None:
    if x is None:
        return None
    header_labels = {"name", "start", "ta", "finish", "break", "stafffood"}
    candidates = [item for item in row if item.boundingBox and normalise_name(item.text) not in header_labels and abs(detection_x(item) - x) < 95]
    if not candidates:
        return None
    item = min(candidates, key=lambda candidate: abs(detection_x(candidate) - x))
    return ExtractedValue(rawValue=item.text, confidence=item.confidence, boundingBox=item.boundingBox)


def parse_daily_rows(detections: list[TextDetection], known_employees: list[dict] | None = None) -> list[DailyRow]:
    if known_employees:
        header_x = {
            "start": find_header_x(detections, "Start"),
            "finish": find_header_x(detections, "Finish"),
            "break": find_header_x(detections, "Break"),
        }
        matches: dict[str, dict] = {}
        employee_names: set[str] = set()
        for employee in known_employees:
            for name in [employee.get("displayName", ""), *employee.get("aliases", [])]:
                if name:
                    matches[normalise_name(name)] = employee
                    employee_names.add(normalise_name(name))

        # Fallback for sheets where OCR merges "Start T & a Finish" into one block.
        cluster_start_x, cluster_finish_x = cluster_time_columns(detections, employee_names)

        parsed: list[DailyRow] = []
        for item in detections:
            if not item.boundingBox:
                continue
            employee, fuzzy_match = match_employee_name(item.text, matches)
            if not employee:
                continue
            row = [candidate for candidate in detections if candidate.boundingBox and abs(detection_y(candidate) - detection_y(item)) <= 28]
            start = nearest_cell(row, header_x["start"])
            finish = nearest_cell(row, header_x["finish"])
            break_value = nearest_cell(row, header_x["break"])
            # If header positions failed to locate the times, fall back to clustering.
            if (start is None or finish is None) and cluster_start_x is not None and cluster_finish_x is not None:
                fallback_start, fallback_finish = assign_time_by_cluster(row, cluster_start_x, cluster_finish_x)
                if start is None:
                    start = fallback_start
                if finish is None:
                    finish = fallback_finish
            # Do not repeat the employee label when a column cell was not detected.
            start = start if start and start.rawValue != item.text else None
            finish = finish if finish and finish.rawValue != item.text else None
            break_value = break_value if break_value and break_value.rawValue != item.text else None
            reasons = ["OCR values require review before counting."]
            if fuzzy_match:
                reasons.append("Employee name was matched approximately from OCR text.")
            if not start or not finish:
                reasons.append("Required row field could not be read confidently.")
            parsed.append(DailyRow.model_validate({
                "rowIndex": len(parsed),
                "rawEmployeeName": item.text,
                "matchedEmployeeId": employee.get("id"),
                "matchedEmployeeName": employee.get("displayName"),
                "employeeMatchConfidence": item.confidence,
                "start": start,
                "finish": finish,
                "break": break_value,
                "reviewRequired": True,
                "reviewReasons": reasons,
            }))
        return parsed

    parsed: list[DailyRow] = []
    for index, row in enumerate(group_rows(detections)):
        cols = group_columns(row)
        employee = cols[0].text if len(cols) > 0 else None
        start = ExtractedValue(rawValue=cols[1].text, confidence=cols[1].confidence, boundingBox=cols[1].boundingBox) if len(cols) > 1 else None
        finish = ExtractedValue(rawValue=cols[2].text, confidence=cols[2].confidence, boundingBox=cols[2].boundingBox) if len(cols) > 2 else None
        break_value = ExtractedValue(rawValue=cols[3].text, confidence=cols[3].confidence, boundingBox=cols[3].boundingBox) if len(cols) > 3 else None
        reasons = []
        if not employee or not start or not finish:
            reasons.append("Required row field could not be read confidently.")
        parsed.append(DailyRow.model_validate({"rowIndex": index, "rawEmployeeName": employee, "start": start, "finish": finish, "break": break_value, "reviewRequired": bool(reasons), "reviewReasons": reasons}))
    return parsed
