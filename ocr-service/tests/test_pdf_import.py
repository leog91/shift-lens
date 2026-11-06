import json

import pypdfium2 as pdfium
import pytest

from app.pdf_import import import_pdf
from app.pdf_batch import sheet_date, page_employees, apply_date_review
from app.schemas import BoundingBox, TextDetection
from app.table_parser import parse_daily_rows


def text(value, x=0, y=0):
    return TextDetection(text=value, confidence=.99, boundingBox=BoundingBox(x=x, y=y, width=20, height=10))


def test_pdf_import_is_resumable_and_retains_original(tmp_path):
    source = tmp_path / 'fictional.pdf'
    document = pdfium.PdfDocument.new()
    page = document.new_page(300, 400)
    page.close()
    document.save(str(source))
    document.close()
    first = import_pdf(str(source), str(tmp_path / 'inbox'))
    second = import_pdf(str(source), str(tmp_path / 'inbox'))
    assert first == second
    from pathlib import Path
    target = Path(first['directory'])
    assert (target / 'original.pdf').read_bytes() == source.read_bytes()
    assert json.loads((target / 'manifest.json').read_text())['pages'] == [{'page': 1, 'filename': 'page-001.png'}]
    original_mtime = (target / 'page-001.png').stat().st_mtime_ns
    import_pdf(str(source), str(tmp_path / 'inbox'))
    assert (target / 'page-001.png').stat().st_mtime_ns == original_mtime


def test_rejects_non_pdf(tmp_path):
    source = tmp_path / 'bad.pdf'
    source.write_text('not a PDF')
    with pytest.raises(ValueError, match='not a PDF'):
        import_pdf(str(source), str(tmp_path / 'inbox'))


def test_date_requires_unambiguous_valid_weekday_and_year():
    assert sheet_date([text('Tuesday 24 March')], 2026) == '2026-03-24'
    assert sheet_date([text('Wednesday 22April')], 2026) == '2026-04-22'
    assert sheet_date([text('Saturday16 May')], 2026) == '2026-05-16'
    assert sheet_date([text('Wednesday 24 March')], 2026) is None
    assert sheet_date([text('Tuesday 31 February')], 2026) is None
    assert sheet_date([text('24 March')], 2026) is None
    assert sheet_date([text('Tuesday 24 March'), text('Wednesday 25 March')], 2026) is None


def test_reviewed_dates_are_preserved_with_audit_context():
    payload = {'date': None, 'rawDate': None, 'dateReview': {'date': '2026-11-01', 'rawDate': '1 ST November', 'reason': 'Transcribed from visible heading; year confirmed by operator.'}}
    apply_date_review(payload, 2026)
    assert payload['date'] == '2026-11-01'
    assert payload['rawDate'] == '1 ST November'
    assert payload['automaticDate'] is None
    with pytest.raises(ValueError):
        apply_date_review(payload, 2025)


def test_unknown_name_is_retained_but_food_is_not_an_employee():
    employees = [{'id': 'ana', 'displayName': 'Ana', 'aliases': []}]
    detections = [text('Name', 0), text('Start', 100), text('Ana', 0, 40), text('Beatrice', 0, 80), text('Pizza', 500, 80)]
    candidates = page_employees(detections, employees)
    assert [e['displayName'] for e in candidates] == ['Ana', 'Beatrice']


def test_suffixed_names_are_not_collapsed_into_another_employee():
    employees = [{'id': 'beatrice', 'displayName': 'Beatrice', 'aliases': []}]
    detections = [text('Name', 0), text('Start', 100), text('Beatrice', 0, 40), text('Beatrice S', 0, 80)]
    candidates = page_employees(detections, employees)
    rows = parse_daily_rows(detections, candidates)
    assert len(set(row.matchedEmployeeId for row in rows)) == 2


@pytest.mark.parametrize('raw,minutes', [('No', 0), ('30 min', 30), ('15', 15), ('-', None), ('?', None)])
def test_breaks_do_not_borrow_finish_or_food(raw, minutes):
    detections = [text('Name', 0), text('Start', 100), text('T & a', 200), text('Finish', 300), text('Break', 400), text('Staff food', 500),
                  text('Ana', 0, 50), text('09:00', 100, 50), text('17:00', 300, 50), text(raw, 400, 50), text('Pizza', 500, 50)]
    row = parse_daily_rows(detections, [{'id': 'ana', 'displayName': 'Ana', 'aliases': []}])[0]
    assert row.break_.minutes == minutes
    assert row.reviewRequired is True
    detections = [d for d in detections if d.text != raw]
    row = parse_daily_rows(detections, [{'id': 'ana', 'displayName': 'Ana', 'aliases': []}])[0]
    assert row.break_ is None
