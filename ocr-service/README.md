# ShiftLens OCR Service

Local FastAPI companion for ShiftLens. It preprocesses phone photos with OpenCV, runs OCR behind a `PaddleEngine` boundary, groups text into rows/columns, and returns typed Pydantic responses.

Install:

```bash
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
```

Run:

```bash
python3 -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8001
```

PaddleOCR and PaddlePaddle are included in `requirements.txt`. The first run downloads the English OCR models to the local PaddleX cache. ShiftLens disables Paddle's oneDNN backend because it can fail on some CPU/Python combinations.
