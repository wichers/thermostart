from flask import Blueprint, render_template

errors = Blueprint("errors", __name__)


@errors.app_errorhandler(404)
def error_404(error):
    return render_template("errors/404.html", title="Not Found"), 404


@errors.app_errorhandler(403)
def error_403(error):
    return render_template("errors/403.html", title="Forbidden"), 403


@errors.app_errorhandler(500)
def error_500(error):
    return render_template("errors/500.html", title="Server Error"), 500
