"""Checkpoint PDF OCR page by page; restart workers to bound native model memory.

Run from the repository root with the OCR virtualenv Python. No cloud requests.
"""
import argparse
from datetime import date
import json
import os
from pathlib import Path
import re
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed

from .table_parser import parse_daily_rows, find_header_x, detection_x, detection_y, normalise_name, match_employee_name


def page_employees(detections, employees):
    """Retain unknown printed names as explicit, review-required identities."""
    matches = {normalise_name(name): e for e in employees for name in [e['displayName'], *e.get('aliases', [])]}
    name_x = find_header_x(detections, 'Name')
    start_x = find_header_x(detections, 'Start')
    if name_x is None or start_x is None:
        return employees
    header = next(d for d in detections if normalise_name(d.text) == 'name')
    additional = {}
    for item in detections:
        if not item.boundingBox or detection_y(item) <= detection_y(header):
            continue
        if abs(detection_x(item) - name_x) > abs(start_x - name_x) * .45:
            continue
        if not re.fullmatch(r'[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ .\'-]{1,25}', item.text.strip()):
            continue
        matched, fuzzy = match_employee_name(item.text, matches)
        if matched:
            # A suffix can identify a different printed person ("Ana S" vs
            # "Ana"). Never collapse these labels via approximate matching.
            names = [normalise_name(n) for n in [matched['displayName'], *matched.get('aliases', [])]]
            if not fuzzy or not any(normalise_name(item.text).startswith(n) for n in names):
                continue
        slug = normalise_name(item.text)
        additional[slug] = {'id': f'pdf-employee-{slug}', 'displayName': item.text.strip(), 'aliases': []}
    return [*employees, *additional.values()]


def sheet_date(detections, year):
    months = 'January February March April May June July August September October November December'.split()
    weekdays = 'Monday Tuesday Wednesday Thursday Friday Saturday Sunday'.split()
    found = set()
    for item in detections:
        match = re.fullmatch(r'(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s*(\d{1,2})(?:st|nd|rd|th)?\s*(' + '|'.join(months) + r')', item.text.strip(), re.I)
        if not match:
            continue
        try:
            value = date(year, next(i + 1 for i, m in enumerate(months) if m.lower() == match[3].lower()), int(match[2]))
        except ValueError:
            continue
        if weekdays[value.weekday()].lower() == match[1].lower():
            found.add(value.isoformat())
    return next(iter(found)) if len(found) == 1 else None


def atomic_json(path, payload):
    temporary = path.with_suffix('.tmp')
    temporary.write_text(json.dumps(payload, indent=2), encoding='utf-8')
    temporary.replace(path)


def apply_date_review(payload, year):
    review = payload.get('dateReview')
    if review:
        if date.fromisoformat(review['date']).year != year or not review.get('reason') or not review.get('rawDate'):
            raise ValueError('A reviewed date must preserve its raw heading, reason and confirmed year.')
        payload['automaticDate'] = payload['date']
        payload['date'] = review['date']
        payload['rawDate'] = review['rawDate']


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('directory', type=Path)
    parser.add_argument('--year', type=int, required=True)
    parser.add_argument('--employees', type=Path, required=True)
    parser.add_argument('--worker', nargs=2, type=int, metavar=('START', 'END'))
    parser.add_argument('--jobs', type=int, choices=range(1, 5), default=1, help='Bounded OCR workers (default: 1). Each uses about 1 GB RAM.')
    parser.add_argument('--apply-script', type=Path, help='Optional bundled Node importer; publish completed batches to the app.')
    parser.add_argument('--reparse', action='store_true', help='Reparse saved detections without rerunning OCR.')
    args = parser.parse_args()
    manifest = json.loads((args.directory / 'manifest.json').read_text())
    cache = args.directory / 'ocr'
    cache.mkdir(exist_ok=True)
    if args.reparse:
        from .schemas import TextDetection
        employees = json.loads(args.employees.read_text())
        for checkpoint in sorted(cache.glob('page-*.json')):
            payload = json.loads(checkpoint.read_text())
            detections = [TextDetection.model_validate(d) for d in payload['detectedText']]
            payload['date'] = sheet_date(detections, args.year)
            payload['rawDate'] = next((d.text for d in detections if payload['date'] and sheet_date([d], args.year) == payload['date']), None)
            apply_date_review(payload, args.year)
            payload['rows'] = [r.model_dump(by_alias=True) for r in parse_daily_rows(detections, page_employees(detections, employees))]
            atomic_json(checkpoint, payload)
        return
    if not args.worker:
        # Loading one model per small group bounds native allocations even on a
        # long import. Completed pages survive interruption and are not rerun.
        def run_batch(start):
            end = min(start + 7, len(manifest['pages']))
            subprocess.run([sys.executable, '-m', 'app.pdf_batch', str(args.directory), '--year', str(args.year), '--employees', str(args.employees), '--worker', str(start), str(end)], check=True)
        with ThreadPoolExecutor(max_workers=args.jobs) as pool:
            futures = [pool.submit(run_batch, start) for start in range(1, len(manifest['pages']) + 1, 8)]
            for future in as_completed(futures):
                future.result()
                if args.apply_script:
                    subprocess.run(['node', str(args.apply_script), str(args.directory), '--apply'], check=True, env={**os.environ, 'SHIFT_LENS_DATA_MODE': 'local'})
        return
    os.environ.setdefault('PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK', 'True')
    os.environ.setdefault('OMP_NUM_THREADS', '2')
    from .paddle_engine import engine
    from PIL import Image
    employees = json.loads(args.employees.read_text())
    for entry in manifest['pages']:
        if not args.worker[0] <= entry['page'] <= args.worker[1]:
            continue
        output = cache / f"{Path(entry['filename']).stem}.json"
        if output.exists():
            print(f"Page {entry['page']}: checkpoint exists", flush=True)
            continue
        image_path = args.directory / entry['filename']
        detections = engine.recognise(str(image_path))
        if not detections:
            raise RuntimeError(engine._initialisation_error or f'No text detected on page {entry["page"]}')
        with Image.open(image_path) as image:
            width, height = image.size
        candidates = page_employees(detections, employees)
        payload = {'page': entry['page'], 'filename': entry['filename'], 'date': sheet_date(detections, args.year), 'imageWidth': width, 'imageHeight': height,
                   'detectedText': [item.model_dump() for item in detections],
                   'rows': [row.model_dump(by_alias=True) for row in parse_daily_rows(detections, candidates)]}
        payload['rawDate'] = next((d.text for d in detections if payload['date'] and sheet_date([d], args.year) == payload['date']), None)
        atomic_json(output, payload)
        print(f"Page {entry['page']}: date={payload['date']}, rows={len(payload['rows'])}", flush=True)


if __name__ == '__main__':
    main()
