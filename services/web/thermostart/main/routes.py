from flask import Blueprint, redirect, render_template, url_for
from flask_login import current_user

main = Blueprint("main", __name__)


@main.route("/")
def homepage():
    if current_user.is_authenticated:
        return redirect(url_for("ui.home"))
    return redirect(url_for("auth.login_page"))
