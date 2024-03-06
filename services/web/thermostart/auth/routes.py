from flask import Blueprint, flash, jsonify, redirect, render_template, request, url_for
from flask_login import current_user, login_required, login_user, logout_user

from thermostart import db
from thermostart.auth.forms import LoginForm, RegistrationForm, UpdateAccountForm
from thermostart.models import Device, Location

auth = Blueprint("auth", __name__)


@auth.route("/register", methods=["GET", "POST"])
def register_page():
    if current_user.is_authenticated:
        return redirect(url_for("main.homepage"))
    form = RegistrationForm()
    if request.method == "POST":
        form.city.query = (
            Location.query.with_entities(Location.id, Location.city)
            .filter_by(id=request.form["city"])
            .order_by(Location.city)
        )
    if form.validate_on_submit():
        device = Device(hardware_id=form.hardware_id.data, password=form.password.data)
        device.location_id = form.city.data.id
        db.session.add(device)
        db.session.commit()
        flash(
            f"Account has been created for you, {device.hardware_id}. You can now log in.",
            "success",
        )
        return redirect(url_for("auth.login_page"))
    return render_template("register.html", title="Sign Up", form=form)


@auth.route("/login", methods=["GET", "POST"])
def login_page():
    form = LoginForm()
    if form.validate_on_submit():
        device = Device.query.filter_by(hardware_id=form.hardware_id.data).first()
        try:
            if device and device.password == form.password.data:
                login_user(user=device)
                flash(f"{device.hardware_id}, you have been logged in!", "success")
                return redirect(url_for("ui.home"))
        except ValueError:
            pass
        flash("Login unsuccessful. Please check hardware_id and password", "danger")
    return render_template("login.html", title="Login", form=form)


@auth.route("/logout", methods=["GET"])
def logout():
    logout_user()
    flash("You have been logged out successfully.", "success")
    return redirect("/login")


@auth.route("/account", methods=["GET", "POST"])
@login_required
def account_page():
    form = UpdateAccountForm(hardware_id=current_user)
    if request.method == "POST":
        location_id = request.form["city"]
    else:
        location_id = current_user.location_id

    (country, city) = (
        Location.query.with_entities(Location.country, Location.city)
        .filter_by(id=location_id)
        .order_by(Location.city)
        .one()
    )
    form.country.data = (country,)

    form.city.query = (
        Location.query.with_entities(Location.id, Location.city)
        .filter_by(country=country)
        .order_by(Location.city)
    )

    if request.method == "GET":
        form.city.data = (location_id, city)

    if form.validate_on_submit():
        current_user.location_id = form.city.data[0]
        current_user.password = form.password.data
        db.session.commit()
        flash("Your account has been updated.", "success")
        return redirect(url_for("auth.account_page"))
    elif request.method == "GET":
        form.hardware_id.data = current_user.hardware_id
    return render_template("account.html", title="Account", form=form)


@auth.route("/account-cities", methods=["POST"])
def cities():
    q = (
        Location.query.with_entities(Location.id, Location.city)
        .filter_by(country=request.form["country"])
        .order_by(Location.city)
    )
    result_dict = [u._asdict() for u in q.all()]
    return jsonify(result_dict)
