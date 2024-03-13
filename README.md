# Thermostart - Cloudless Thermosmart
Make your (currently) useless Thermosmart device cloud independent and get
your old scheduling functionality back.

Created with Flask technology and fully dockerized.

## Flask commands

#### create_db
**Drop** the database (if exists) and **create** a new one with a models' architecture.

## Quick start: dockerize development
In the root folder, copy `.env.example` file and name the new file `.env.dev`.
You may change the values as you need, especially it's a good practice to set
unique SECRET_KEY - at least change some characters there :)

When you're debugging and you want to re-create the database after restart,
you need to add FLASK_DEBUG=1 to your environment file.

After that stay in the root folder and use following commands:
```
# give permissions to your entrypoint.sh file
chmod +x services/web/entrypoint.sh

# build and run
docker-compose build
docker-compose up -d

# delete if not needed anymore
docker-compose down
```
To use the application visit http://localhost:3888 in your browser.

#### Additional useful commands
```
# RUN in DEBUG mode
python manage.py --app thermostart run --debug

# Open shell with app's data
flask --app thermostart shell

# Dynamically change the docker's base image
docker-compose -f docker-compose.prod.yml build --build-arg TS_IMAGE=python:3.12.2-slim-bookworm
```

## Docker compose related commands

```
# Create database / recreate - BE CAREFUL WITH THIS COMMAND IN PRODUCTION!
docker-compose exec web python manage.py create_db

# Docker running opetations
docker-compose build
docker-compose build --no-cache
docker-compose up -d      # d makes in run in the background
docker-compose down       # remove existing container        | CAREFUL IN PRODUCTION!
docker-compose down -v    # include volume of sqlite data    | CAREFUL IN PRODUCTION!

# Docker check logs
docker-compose logs

# Stop containers
docker-compose stop
docker stop thermostart-web-1

# Start containers
docker-compose start
docker start thermostart-web-1
```

## Production
Basically it's the same way as dev server, but you need to use different files:
- create .env.prod for environment variables:
  - `APP_FOLDER=/home/app/web`
  - `DATABASE_URL= <URL with proper database data>`

And most importantly, to every docker command add the "-f" flag: `-f docker-compose.prod.yml`
to point the file that want to use to build images and run. Example:
```
docker-compose -f docker-compose.prod.yml build
```
If you need to create database (if you get Internal error at homepage):
```
docker-compose -f docker-compose.prod.yml exec web python manage.py create_db
```
