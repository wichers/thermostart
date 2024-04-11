#!/bin/sh

echo "Check for upgrade..."
python manage.py has_alembic_version
if (test $? -ne 1)
then
    python manage.py db stamp 26422f1f63d0
fi
python manage.py db upgrade
python manage.py fill_db

exec "$@"
