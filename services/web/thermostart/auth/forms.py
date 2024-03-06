from flask_login import current_user
from flask_wtf import FlaskForm
from wtforms import Label, PasswordField, StringField, SubmitField
from wtforms.validators import (
    DataRequired,
    EqualTo,
    InputRequired,
    Length,
    ValidationError,
)
from wtforms_sqlalchemy.fields import QuerySelectField

from thermostart.models import Device, Location


def location_countries():
    return (
        Location.query.with_entities(Location.country)
        .group_by(Location.country)
        .order_by(Location.country)
    )


def location_cities():
    return (
        Location.query.with_entities(Location.id, Location.city)
        .filter_by(city="Netherlands")
        .order_by(Location.city)
    )


class RegistrationForm(FlaskForm):
    hardware_id = StringField(
        "Hardware ID", validators=[DataRequired(), Length(min=1, max=40)]
    )
    country = QuerySelectField(
        "Country",
        [DataRequired("You need to select a country.")],
        query_factory=location_countries,
        get_pk=lambda a: a.country,
        get_label=lambda a: a.country,
        blank_text="-- Select a country --",
        allow_blank=True,
    )
    city = QuerySelectField(
        "City",
        [DataRequired("You need to select a city.")],
        query_factory=location_cities,
        get_pk=lambda a: a.id,
        get_label=lambda a: a.city,
        blank_text="-- Select a city --",
        allow_blank=True,
    )
    password = PasswordField("Password", validators=[DataRequired()])
    confirm_password = PasswordField(
        "Confirm Password", validators=[DataRequired(), EqualTo("password")]
    )
    submit = SubmitField("Sign up")

    def validate_hardware_id(self, hardware_id):
        device = Device.query.filter_by(hardware_id=hardware_id.data).first()
        if device:
            raise ValidationError(
                "That hardware id is taken. Please choose a different one."
            )


class LoginForm(FlaskForm):
    hardware_id = StringField(
        "Hardware ID", validators=[DataRequired(), Length(min=1, max=40)]
    )
    password = PasswordField("Password", validators=[DataRequired()])
    submit = SubmitField("Login")


class UpdateAccountForm(FlaskForm):
    hardware_id = StringField("Hardware ID")
    country = QuerySelectField(
        "Country",
        [DataRequired("You need to select a country.")],
        query_factory=location_countries,
        get_pk=lambda a: a.country,
        get_label=lambda a: a.country,
        blank_text="-- Select a country --",
        allow_blank=True,
    )
    city = QuerySelectField(
        "City",
        [DataRequired("You need to select a city.")],
        get_pk=lambda a: a.id,
        get_label=lambda a: a.city,
        blank_text="-- Select a city --",
        allow_blank=True,
    )
    password = PasswordField("Password", validators=[DataRequired()])
    confirm_password = PasswordField(
        "Confirm Password", validators=[DataRequired(), EqualTo("password")]
    )

    submit = SubmitField("Change")
