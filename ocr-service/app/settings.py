from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    service_name: str = "shiftlens-ocr"
    paddle_enabled: bool = False


settings = Settings()
