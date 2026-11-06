"""Render local PDFs into a resumable, content-addressed evidence folder."""
import argparse
import hashlib
import json
import shutil
from pathlib import Path

import pypdfium2 as pdfium

MAX_PAGES = 500
MAX_BYTES = 100 * 1024 * 1024


def import_pdf(source: str, inbox: str) -> dict:
    source_path = Path(source)
    if source_path.stat().st_size > MAX_BYTES:
        raise ValueError('PDF must be under 100 MB.')
    with source_path.open('rb') as source_file:
        if source_file.read(5) != b'%PDF-':
            raise ValueError('File is not a PDF.')
        source_file.seek(0)
        digest = hashlib.file_digest(source_file, 'sha256').hexdigest()
    target = Path(inbox) / f'pdf-{digest}'
    with pdfium.PdfDocument(str(source_path)) as document:
        count = len(document)
        if count < 1 or count > MAX_PAGES:
            raise ValueError(f'PDF must contain 1-{MAX_PAGES} pages.')
        target.mkdir(parents=True, exist_ok=True)
        original = target / 'original.pdf'
        if not original.exists():
            temporary_original = target / 'original.tmp'
            shutil.copyfile(source_path, temporary_original)
            temporary_original.replace(original)
        pages = []
        for index in range(count):
            filename = f'page-{index + 1:03d}.png'
            output = target / filename
            if not output.exists():
                page = document[index]
                try:
                    # Bound raster memory while retaining readable handwriting.
                    width, height = page.get_size()
                    scale = min(1.5, 2400 / max(width, height))
                    bitmap = page.render(scale=scale)
                    try:
                        image = bitmap.to_pil()
                        temporary = output.with_suffix('.tmp')
                        try:
                            image.save(temporary, format='PNG')
                            temporary.replace(output)
                        finally:
                            image.close()
                    finally:
                        bitmap.close()
                finally:
                    page.close()
            pages.append({'page': index + 1, 'filename': filename})
        manifest = {'version': 1, 'sha256': digest, 'sourceFilename': source_path.name,
                    'original': 'original.pdf', 'pages': pages}
        manifest_path = target / 'manifest.json'
        temporary_manifest = target / 'manifest.tmp'
        temporary_manifest.write_text(json.dumps(manifest, indent=2), encoding='utf-8')
        temporary_manifest.replace(manifest_path)
        return {'directory': str(target), 'pageCount': count, 'sha256': digest}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('source')
    parser.add_argument('inbox')
    args = parser.parse_args()
    print(json.dumps(import_pdf(args.source, args.inbox)))
