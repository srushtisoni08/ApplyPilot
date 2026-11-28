from types import SimpleNamespace
import unittest
from unittest.mock import MagicMock, patch

from fastapi import HTTPException

from app.routes import auth


class OAuthLoginTests(unittest.TestCase):
    def setUp(self):
        self.user = SimpleNamespace(
            id=3,
            email="user@example.com",
            password_hash="existing-password-hash",
            gmail_email="user@example.com",
            google_access_token=None,
            google_refresh_token=None,
            is_active=True,
        )
        self.db = MagicMock()
        self.request = SimpleNamespace(cookies={auth.OAUTH_STATE_COOKIE: "signed-state"})
        self.flow = MagicMock()
        self.flow.credentials = SimpleNamespace(token="access-token", refresh_token="refresh-token")
        self.gmail = MagicMock()
        self.gmail.users.return_value.getProfile.return_value.execute.return_value = {
            "emailAddress": "user@example.com"
        }
        self.patches = [
            patch("app.routes.auth.verify_oauth_state", return_value=None),
            patch("app.routes.auth._flow", return_value=self.flow),
            patch("app.routes.auth.build", return_value=self.gmail),
            patch("app.routes.auth.encrypt", side_effect=lambda value: f"encrypted:{value}"),
            patch("app.routes.auth.set_session_cookie"),
        ]
        for item in self.patches:
            item.start()
            self.addCleanup(item.stop)

    def test_google_sign_in_accepts_matching_password_account(self):
        self.db.scalar.side_effect = [self.user, None]

        response = auth.callback("oauth-code", "signed-state", self.request, self.db)

        self.assertEqual(response.headers["location"], "http://localhost:5173/?gmail=connected")
        self.assertEqual(self.user.google_access_token, "encrypted:access-token")
        self.assertEqual(self.user.google_refresh_token, "encrypted:refresh-token")
        self.db.commit.assert_called_once()
        auth.set_session_cookie.assert_called_once_with(response, self.user.id)

    def test_google_sign_in_rejects_unmatched_account(self):
        self.db.scalar.return_value = None

        with self.assertRaises(HTTPException) as raised:
            auth.callback("oauth-code", "signed-state", self.request, self.db)

        self.assertEqual(raised.exception.status_code, 400)
        auth.set_session_cookie.assert_not_called()
        self.db.commit.assert_not_called()


if __name__ == "__main__":
    unittest.main()
