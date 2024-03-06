import os

from dotenv import load_dotenv

load_dotenv()


class Config:
    STATIC_FOLDER = f"{os.getenv('APP_FOLDER')}/thermostart/static"
    SECRET_KEY = os.environ.get("SECRET_KEY")
    SQLALCHEMY_DATABASE_URI = os.getenv("DATABASE_URL")
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # In app values that are changeable via environment variables
    AI_MOVE_DELAY_SECONDS = float(os.getenv("AI_MOVE_DELAY_SECONDS", 1.5))
