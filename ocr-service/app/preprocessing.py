from hashlib import sha1
from pathlib import Path
import cv2
import numpy as np
from PIL import Image, ImageOps

from .quality import quality_warnings


def decode_image(path: str) -> np.ndarray:
    with Image.open(path) as pil_image:
        pil_image = ImageOps.exif_transpose(pil_image).convert("RGB")
        rgb = np.array(pil_image)
    return cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)


def preprocess_image(path: str) -> tuple[np.ndarray, dict]:
    image = decode_image(path)
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    enhanced = cv2.equalizeHist(gray)
    sharpened = cv2.addWeighted(enhanced, 1.25, cv2.GaussianBlur(enhanced, (0, 0), 3), -0.25, 0)
    metadata = {
        "width": int(image.shape[1]),
        "height": int(image.shape[0]),
        "rotated": False,
        "pageDetected": False,
        "qualityWarnings": quality_warnings(image),
    }
    return sharpened, metadata


def save_processed_preview(image: np.ndarray, original_path: str) -> str:
    source = Path(original_path)
    # Two weeks can both hold a "sheet.jpg", so keep the source path in the name.
    digest = sha1(str(source.resolve()).encode("utf-8")).hexdigest()[:10]
    target = Path("extracted") / f"{source.stem}-{digest}-processed.png"
    target.parent.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(target), image)
    return str(target)
