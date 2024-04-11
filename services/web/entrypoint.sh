#!/bin/sh

echo "Check for upgrade..."
python manage.py needs_alembic_version
if (test $? -eq 1)
then
    python manage.py db stamp 26422f1f63d0
fi
python manage.py db upgrade
python manage.py fill_db

exec "$@"
