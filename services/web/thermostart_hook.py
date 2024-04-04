import os

os.environ["DATABASE_PATH"] = os.getenv("LOCALAPPDATA") + "/thermostart/thermostart.db"
os.environ["DATABASE_URL"] = (
    "sqlite:///" + os.getenv("LOCALAPPDATA") + "/thermostart/thermostart.db"
)
os.environ["FLASK_APP"] = "thermostart/__init__.py"
os.environ["SECRET_KEY"] = "some-insecure-SECRETkkkeeeyyy213u02toipw3tj-239jg-23gpo"
