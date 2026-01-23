import easyocr
import io

import logging

# Lazy loader for the reader to avoid heavy startup cost if OCR isn't used
_reader = None
logger = logging.getLogger(__name__)

def get_reader():
    global _reader
    if _reader is None:
        # Initialize English reader. gpu=False by default to be safe on generic dev machines, 
        # but could be True if requested/detected.
        logger.info("Initializing EasyOCR Reader...")
        _reader = easyocr.Reader(['en'], gpu=False)
    return _reader

def extract_text_from_image(image_bytes: bytes) -> str:
    """
    Extracts text from raw image bytes using EasyOCR.
    """
    try:
        logger.info("OCR started")
        reader = get_reader()
        # EasyOCR supports file path, url, or bytes. containing the image
        result = reader.readtext(image_bytes, detail=0) 
        # detail=0 returns just the list of strings
        text_result = "\n".join(result)
        logger.info(f"OCR result: {text_result}")
        return text_result
    except Exception as e:
        logger.error(f"OCR Error: {e}")
        return ""
