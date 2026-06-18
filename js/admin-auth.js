(function () {
  "use strict";

  var loginForm = document.getElementById("adminLoginForm");
  var loginStatus = document.getElementById("adminLoginStatus");
  var signInButton = document.getElementById("adminSignInButton");
  var forgotPasswordButton = document.getElementById("forgotPasswordButton");
  var loginLabel = document.querySelector("[data-login-label]");
  var loginLoading = document.querySelector("[data-login-loading]");
  var isLoginPage = document.body.getAttribute("data-admin-page") === "login";
  var authReady = false;

  function setStatus(message, type) {
    if (!loginStatus) {
      return;
    }
    loginStatus.textContent = message || "";
    loginStatus.classList.remove("is-error", "is-success", "is-muted");
    if (type) {
      loginStatus.classList.add(type);
    }
  }

  function setLoading(isLoading) {
    if (signInButton) {
      signInButton.disabled = Boolean(isLoading);
    }
    if (loginLabel) {
      loginLabel.hidden = Boolean(isLoading);
    }
    if (loginLoading) {
      loginLoading.hidden = !isLoading;
    }
  }

  function loginUrl() {
    return "login.html";
  }

  function requestsUrl() {
    return "requests.html";
  }

  function redirectToLogin() {
    if (!isLoginPage) {
      window.location.href = loginUrl();
    }
  }

  function redirectToRequests() {
    if (isLoginPage) {
      window.location.href = requestsUrl();
    }
  }

  function roleAllowsAdminAccess(session) {
    // TODO: After the Liberty Blue profiles table and RLS policies exist, read the
    // user's role from that trusted profile source and enforce admin/reviewer access.
    // Until then, authentication gates the admin shell but role checks are not enforced.
    return Boolean(session);
  }

  async function loadAuth() {
    if (!window.LibertyBlueSupabase || typeof window.LibertyBlueSupabase.loadClient !== "function") {
      return {
        client: null,
        config: {
          isConfigured: false,
          message: "Supabase auth is not available on this page."
        }
      };
    }

    return window.LibertyBlueSupabase.loadClient();
  }

  function handleMissingConfig(config) {
    if (isLoginPage) {
      setStatus(config.message, "is-muted");
    }
  }

  async function restoreSession(client) {
    var result = await client.auth.getSession();
    var session = result && result.data ? result.data.session : null;

    if (session && roleAllowsAdminAccess(session)) {
      redirectToRequests();
      return session;
    }

    if (!session && !isLoginPage) {
      redirectToLogin();
    }

    return session;
  }

  function listenForAuthChanges(client) {
    client.auth.onAuthStateChange(function (event, session) {
      if (event === "SIGNED_OUT") {
        redirectToLogin();
        return;
      }

      if (session && roleAllowsAdminAccess(session)) {
        redirectToRequests();
      }
    });
  }

  async function signIn(email, password) {
    var auth = await loadAuth();
    if (!auth.client) {
      handleMissingConfig(auth.config);
      return;
    }

    var result = await auth.client.auth.signInWithPassword({
      email: email,
      password: password
    });

    if (result.error) {
      throw result.error;
    }

    if (!roleAllowsAdminAccess(result.data.session)) {
      throw new Error("Your account is not authorized for the Liberty Blue admin dashboard.");
    }

    redirectToRequests();
  }

  async function signOut() {
    var auth = await loadAuth();
    if (auth.client) {
      await auth.client.auth.signOut();
    }
    window.location.href = loginUrl();
  }

  async function requestPasswordReset(email) {
    var auth = await loadAuth();
    if (!auth.client) {
      handleMissingConfig(auth.config);
      return;
    }

    var result = await auth.client.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.href
    });

    if (result.error) {
      throw result.error;
    }

    setStatus("Password reset email requested.", "is-success");
  }

  function bindLoginForm() {
    if (!loginForm) {
      return;
    }

    loginForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      var email = document.getElementById("adminEmail").value.trim();
      var password = document.getElementById("adminPassword").value;

      if (!email || !password) {
        setStatus("Enter both email and password.", "is-error");
        return;
      }

      setStatus("", "");
      setLoading(true);

      try {
        await signIn(email, password);
      } catch (error) {
        setStatus(error.message || "Unable to sign in.", "is-error");
      } finally {
        setLoading(false);
      }
    });
  }

  function bindPasswordReset() {
    if (!forgotPasswordButton) {
      return;
    }

    forgotPasswordButton.addEventListener("click", async function () {
      var email = document.getElementById("adminEmail").value.trim();
      if (!email) {
        setStatus("Enter your email address before requesting a reset.", "is-error");
        return;
      }

      setLoading(true);
      try {
        await requestPasswordReset(email);
      } catch (error) {
        setStatus(error.message || "Unable to request a password reset.", "is-error");
      } finally {
        setLoading(false);
      }
    });
  }

  function bindSignOutLinks() {
    document.querySelectorAll("[data-admin-signout]").forEach(function (link) {
      link.addEventListener("click", function (event) {
        event.preventDefault();
        signOut();
      });
    });
  }

  async function initializeAuth() {
    bindLoginForm();
    bindPasswordReset();
    bindSignOutLinks();

    try {
      var auth = await loadAuth();
      if (!auth.client) {
        handleMissingConfig(auth.config);
        authReady = true;
        return;
      }

      await restoreSession(auth.client);
      listenForAuthChanges(auth.client);
      authReady = true;
    } catch (error) {
      if (isLoginPage) {
        setStatus(error.message || "Unable to initialize authentication.", "is-error");
      }
      authReady = true;
    }
  }

  window.LibertyBlueAuth = {
    initializeAuth: initializeAuth,
    requestPasswordReset: requestPasswordReset,
    restoreSession: restoreSession,
    signIn: signIn,
    signOut: signOut,
    isReady: function () {
      return authReady;
    }
  };

  initializeAuth();
})();
