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


def parse_roster_rows(detections: list[TextDetection], known_employees: list[dict], week_starting: str, close_times: dict[str, str]) -> list[DailyRow]:
    """Read a weekly roster grid; every proposal remains review-required."""
    day_names = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
    day_prefixes = {day[:3]: index for index, day in enumerate(day_names)}
    day_columns: list[tuple[int, float]] = []
    for item in detections:
        if not item.boundingBox:
            continue
        text = normalise_name(item.text)
        for prefix, index in day_prefixes.items():
            if text.startswith(prefix):
                day_columns.append((index, detection_x(item)))
                break
    day_columns = list(dict(day_columns).items())
    # Some rosters label Monday with only the date (for example "27 July")
    # and abbreviate the remaining headers to Tue-Sun. Recover Monday's column
    # from the regular weekly grid rather than treating the roster as unreadable.
    if len(day_columns) == 6 and all(index in dict(day_columns) for index in range(1, 7)):
        columns_by_day = dict(day_columns)
        gap = columns_by_day[2] - columns_by_day[1]
        day_columns.append((0, columns_by_day[1] - gap))
    if len(day_columns) < 7:
        return []
    day_columns.sort()
    employee_matches: dict[str, dict] = {}
    for employee in known_employees:
        for name in [employee.get("displayName", ""), *employee.get("aliases", [])]:
            if name:
                employee_matches[normalise_name(name)] = employee
    start_of_week = __import__("datetime").date.fromisoformat(week_starting)
    rows: list[DailyRow] = []
    for label in detections:
        if not label.boundingBox:
            continue
        employee, fuzzy = match_employee_name(label.text, employee_matches)
        if not employee:
            continue
        row_cells = [item for item in detections if item.boundingBox and abs(detection_y(item) - detection_y(label)) <= 22 and detection_x(item) > detection_x(label) + 20]
        for day_index, column_x in day_columns:
            next_x = next((x for next_index, x in day_columns if next_index == day_index + 1), column_x + 160)
            previous_x = next((x for previous_index, x in reversed(day_columns) if previous_index == day_index - 1), column_x - 160)
            left = (previous_x + column_x) / 2
            right = (column_x + next_x) / 2
            cells = sorted([item for item in row_cells if left <= detection_x(item) < right], key=detection_x)
            raw = " ".join(item.text for item in cells).strip()
            normalised_raw = normalise_name(raw)
            if not raw or normalised_raw in {"off", "holiday", "hol", "stock", "cleaning"}:
                continue
            assignment_type = "standby" if "sb" in normalised_raw else "office" if normalised_raw.startswith("on") else None
            if assignment_type and not re.search(r"\d", raw):
                rows.append(DailyRow.model_validate({
                    "rowIndex": len(rows),
                    "date": str(start_of_week + __import__("datetime").timedelta(days=day_index)),
                    "rawEmployeeName": label.text,
                    "matchedEmployeeId": employee.get("id"),
                    "matchedEmployeeName": employee.get("displayName"),
                    "employeeMatchConfidence": label.confidence,
                    "assignmentType": assignment_type,
                    "start": None,
                    "finish": None,
                    "break": None,
                    "reviewRequired": True,
                    "reviewReasons": ["Marked SB: standby/on-call assignment." if assignment_type == "standby" else "Marked On: manager/office work requires manual time entry."]
                }))
                continue
            # Roster cells abbreviate whole-hour times (for example, "3 - close"
            # means 15:00 to close) and may contain two shifts separated by a slash.
            matches = re.findall(r"(\d{1,2}(?:[:.]\d{2})?)\s*[-–]\s*(\d{1,2}(?:[:.]\d{2})?|cl(?:ose)?)", raw, re.IGNORECASE)
            if not matches:
                # Faint printed dashes are often dropped by OCR. Within one grid
                # cell, two time tokens still form a review-required shift.
                tokens = re.findall(r"\d{1,2}(?:[:.]\d{2})?|cl(?:ose)?", raw, re.IGNORECASE)
                if len(tokens) == 2:
                    matches = [(tokens[0], tokens[1])]
            for start_raw, finish_raw in matches:
                def clock(value: str) -> str:
                    value = value.replace(".", ":")
                    if ":" in value:
                        hours, minutes = value.split(":", 1)
                        hour = int(hours)
                        if 1 <= hour <= 7:
                            hour += 12
                        return f"{hour:02d}:{int(minutes):02d}"
                    hour = int(value)
                    # This roster omits PM for afternoon/evening times 1-7.
                    if 1 <= hour <= 7:
                        hour += 12
                    return f"{hour:02d}:00"

                start = clock(start_raw)
                close = finish_raw.lower().startswith("cl")
                finish = close_times.get(day_names[day_index], "") if close else clock(finish_raw)
                if not close and finish <= start:
                    # A bare finish such as "2 - 9" is an afternoon/evening
                    # shift, not an overnight shift from 14:00 to 09:00.
                    finish_hour, finish_minute = map(int, finish.split(":"))
                    finish = f"{finish_hour + 12:02d}:{finish_minute:02d}"
                if not finish:
                    continue
                reasons = ["Roster OCR proposal requires review before it is treated as an estimate. The break defaults to 0 minutes and can be edited before confirmation."]
                if len(matches) > 1:
                    reasons.append("This is a split shift. The gap between its two roster entries is the unpaid break.")
                if "sb" in normalised_raw:
                    reasons.append("Marked SB: standby/on-call roster assignment.")
                if "tr" in normalised_raw:
                    reasons.append("Marked TR: training roster assignment.")
                if close:
                    reasons.append(f"CLOSE was interpreted using the configured {finish} close time.")
                if fuzzy:
                    reasons.append("Employee name was matched approximately from OCR text.")
                rows.append(DailyRow.model_validate({
                    "rowIndex": len(rows),
                    "date": str(start_of_week + __import__("datetime").timedelta(days=day_index)),
                    "rawEmployeeName": label.text,
                    "matchedEmployeeId": employee.get("id"),
                    "matchedEmployeeName": employee.get("displayName"),
                    "employeeMatchConfidence": label.confidence,
                    "start": {"rawValue": start_raw, "normalisedValue": start, "confidence": label.confidence},
                    "finish": {"rawValue": finish_raw.upper() if close else finish_raw, "normalisedValue": finish, "confidence": label.confidence},
                    "break": None,
                    "reviewRequired": True,
                    "reviewReasons": reasons,
                }))
    return rows
