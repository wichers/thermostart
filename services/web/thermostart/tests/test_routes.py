class TestBasicRoutesAnonymous:
    def test_homepage(self, client):
        response = client.get("/")
        assert response.status_code == 200
        assert b"Homepage</title>" in response.data

    def test_about_page(self, client):
        response = client.get("/about")
        assert response.status_code == 200
        assert b"About page</title>" in response.data

    def test_404_page(self, client):
        response = client.get("/not_existing_page")
        assert response.status_code == 404
        assert b"(404)" in response.data


class TestUserRoutesAnonymous:
    def test_login_page(self, client):
        response = client.get("/login")
        assert response.status_code == 200
        assert b"Login</title>" in response.data

    def test_account_page_redirects(self, client):
        response = client.get("/account")
        assert response.status_code == 302
        assert b'href="/login?next=%2Faccount"' in response.data

    def test_register_page(self, client):
        response = client.get("/register")
        assert response.status_code == 200
        assert b"Register</title>" in response.data

    def test_logout_page(self, client):
        response = client.get("/logout")
        assert response.status_code == 302
        assert b'href="/"' in response.data


class TestGamesRoutesAnonymous:
    def test_sessions_get_redirects(self, client):
        response = client.get("/sessions")
        assert response.status_code == 302
        assert b'href="/login?next=%2Fsessions"' in response.data

    def test_stats_get_redirects(self, client):
        response = client.get("/stats")
        assert response.status_code == 302
        assert b'href="/login?next=%2Fstats"' in response.data

    def test_sessions_trailing_slash_404(self, client):
        response = client.get("/sessions/")
        assert response.status_code == 404

    def test_game_session_get_redirects(self, client):
        response = client.get("/sessions/1")
        assert response.status_code == 404

    def test_game_session_post_raises_exception(self, client):
        response = client.post("/sessions/1")
        assert response.status_code == 404

    def test_game_get_redirects(self, client):
        response = client.get("/game/1")
        assert response.status_code == 302
        assert b'href="/login?next=%2Fgame%2F1"' in response.data


class TestUserRoutesLoggedUser:
    def test_login_page(self, client):
        response = client.get("/login")
        assert response.status_code == 200
        assert b"Login</title>" in response.data

    def test_account_page_redirects(self, client):
        response = client.get("/account")
        assert response.status_code == 302
        assert b'href="/login?next=%2Faccount"' in response.data
