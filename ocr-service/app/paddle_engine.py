from typing import Any

from .schemas import BoundingBox, TextDetection


class PaddleEngine:
    def __init__(self) -> None:
        self._engine = None
        self._initialisation_error: str | None = None

    def _get_engine(self):
        if self._engine is not None:
            return self._engine
        if self._initialisation_error is not None:
            return None
        try:
            from paddleocr import PaddleOCR

            # Paddle's default oneDNN backend fails on some CPU/Python combinations.
            self._engine = PaddleOCR(
                lang="en",
                use_doc_orientation_classify=False,
                use_doc_unwarping=False,
                use_textline_orientation=False,
                enable_mkldnn=False,
            )
        except Exception as exc:
            self._initialisation_error = str(exc)
        return self._engine

    def available(self) -> bool:
        return self._get_engine() is not None

    def recognise(self, image_path: str) -> list[TextDetection]:
        engine = self._get_engine()
        if engine is None:
            return []

        detections: list[TextDetection] = []
        for result in engine.predict(image_path):
            payload: dict[str, Any] = dict(result)
            texts = payload.get("rec_texts", [])
            scores = payload.get("rec_scores", [])
            boxes = payload.get("rec_boxes", [])
            for text, score, box in zip(texts, scores, boxes):
                if not isinstance(text, str) or not text.strip() or len(box) != 4:
                    continue
                x1, y1, x2, y2 = [float(value) for value in box]
                detections.append(
                    TextDetection(
                        text=text,
                        confidence=float(score),
                        boundingBox=BoundingBox(x=x1, y=y1, width=x2 - x1, height=y2 - y1),
                    )
                )
        return detections


engine = PaddleEngine()
