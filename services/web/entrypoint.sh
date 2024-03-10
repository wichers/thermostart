#!/bin/sh

if [ "$FLASK_DEBUG" = "1" ]
then
    echo "Creating the database tables..."
    python manage.py create_db
    echo "Tables created"
fi

exec "$@"
