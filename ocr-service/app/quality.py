import cv2
import numpy as np


def quality_warnings(image: np.ndarray) -> list[str]:
    warnings: list[str] = []
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if image.ndim == 3 else image
    height, width = gray.shape[:2]
    if width < 900 or height < 900:
        warnings.append("The photo may be low resolution.")
    blur_score = cv2.Laplacian(gray, cv2.CV_64F).var()
    if blur_score < 60:
        warnings.append("The photo may be blurry.")
    mean = float(gray.mean())
    if mean < 55:
        warnings.append("The image is dark; extraction may be less accurate.")
    if mean > 225:
        warnings.append("The image is very bright; extraction may be less accurate.")
    return warnings
