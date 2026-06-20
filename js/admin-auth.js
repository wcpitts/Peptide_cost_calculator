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
  var currentProfile = null;
  var loginMessageKey = "libertyBlueAdminLoginMessage";
  var suppressNextSignedOutMessage = false;

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

  function isLocalPreview() {
    return window.location.protocol === "file:";
  }

  function allowLocalPreview() {
    if (!isLoginPage && isLocalPreview()) {
      document.body.setAttribute("data-auth-state", "local-preview");
      return true;
    }
    return false;
  }

  function redirectToLogin(message, type) {
    if (!isLoginPage && message) {
      queueLoginMessage(message, type || "is-error");
    }
    if (!isLoginPage) {
      window.location.href = loginUrl();
    }
  }

  function redirectToRequests() {
    if (isLoginPage) {
      window.location.href = requestsUrl();
    }
  }

  function queueLoginMessage(message, type) {
    try {
      window.sessionStorage.setItem(loginMessageKey, JSON.stringify({
        message: message,
        type: type || "is-error"
      }));
    } catch (error) {
      // Session storage is a convenience for redirect messages; auth still works without it.
    }
  }

  function consumeLoginMessage() {
    if (!isLoginPage) {
      return;
    }

    try {
      var raw = window.sessionStorage.getItem(loginMessageKey);
      if (!raw) {
        return;
      }
      window.sessionStorage.removeItem(loginMessageKey);
      var parsed = JSON.parse(raw);
      if (parsed && parsed.message) {
        setStatus(parsed.message, parsed.type || "is-muted");
      }
    } catch (error) {
      window.sessionStorage.removeItem(loginMessageKey);
    }
  }

  function makeAuthError(message, code) {
    var error = new Error(message);
    error.code = code;
    return error;
  }

  function friendlyError(error) {
    var message = error && error.message ? error.message : String(error || "");

    if (/invalid login credentials/i.test(message)) {
      return "Wrong email or password.";
    }

    if (/failed to fetch|network|load failed|timeout/i.test(message)) {
      return "Network or Supabase error. Check your connection and try again.";
    }

    return message || "Supabase error. Try again.";
  }

  function roleAllowsAdminAccess(profile) {
    return Boolean(profile && profile.active && (profile.role === "admin" || profile.role === "reviewer"));
  }

  function updateUserDisplay(profile) {
    document.querySelectorAll(".admin-user-chip").forEach(function (chip) {
      chip.textContent = profile.full_name || profile.email || "Liberty Blue Admin";
    });
    document.body.setAttribute("data-admin-role", profile.role || "");
  }

  async function getAuthorizedProfile(client, session) {
    if (!session || !session.user || !session.user.id) {
      throw makeAuthError("No active Supabase session was found. Sign in to continue.", "no_session");
    }

    var result = await client
      .from("profiles")
      .select("id, full_name, email, role, active")
      .eq("id", session.user.id)
      .maybeSingle();

    if (result.error) {
      throw makeAuthError("Network or Supabase error while reading your admin profile: " + result.error.message, "profile_error");
    }

    if (!result.data) {
      throw makeAuthError("No profile row found for this account. Ask an administrator to create an active admin or reviewer profile.", "no_profile");
    }

    if (!result.data.active) {
      throw makeAuthError("This account is inactive. Ask an administrator to reactivate access.", "inactive_profile");
    }

    if (!roleAllowsAdminAccess(result.data)) {
      throw makeAuthError("This account is not authorized for the Liberty Blue admin dashboard.", "unauthorized_role");
    }

    currentProfile = result.data;
    updateUserDisplay(result.data);
    return result.data;
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
      setLoading(false);
    } else if (allowLocalPreview()) {
      return;
    } else {
      redirectToLogin(config.message, "is-muted");
    }
  }

  async function restoreSession(client) {
    var result = await client.auth.getSession();
    if (result.error) {
      throw result.error;
    }

    var session = result && result.data ? result.data.session : null;

    if (!session) {
      if (allowLocalPreview()) {
        return null;
      }
      if (!isLoginPage) {
        redirectToLogin("Sign in to access the Liberty Blue admin dashboard.", "is-muted");
      }
      return null;
    }

    try {
      await getAuthorizedProfile(client, session);
    } catch (error) {
      suppressNextSignedOutMessage = true;
      await client.auth.signOut();
      redirectToLogin(friendlyError(error), "is-error");
      if (isLoginPage) {
        setStatus(friendlyError(error), "is-error");
      }
      return null;
    }

    if (isLoginPage) {
      setStatus("Signed in. Opening dashboard...", "is-success");
      redirectToRequests();
      return session;
    }

    return session;
  }

  function listenForAuthChanges(client) {
    client.auth.onAuthStateChange(function (event, session) {
      if (event === "SIGNED_OUT") {
        currentProfile = null;
        if (allowLocalPreview()) {
          return;
        }
        if (suppressNextSignedOutMessage) {
          suppressNextSignedOutMessage = false;
          return;
        }
        redirectToLogin("Signed out.", "is-muted");
        return;
      }

      if (session && (event === "SIGNED_IN" || event === "TOKEN_REFRESHED")) {
        getAuthorizedProfile(client, session).then(function () {
          redirectToRequests();
        }).catch(function (error) {
          suppressNextSignedOutMessage = true;
          client.auth.signOut();
          if (isLoginPage) {
            setStatus(friendlyError(error), "is-error");
          } else {
            redirectToLogin(friendlyError(error), "is-error");
          }
        });
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
      throw makeAuthError(friendlyError(result.error), "sign_in_error");
    }

    await getAuthorizedProfile(auth.client, result.data.session);
    setStatus("Signed in. Opening dashboard...", "is-success");
    redirectToRequests();
  }

  async function signOut() {
    if (isLocalPreview() && !isLoginPage) {
      queueLoginMessage("Signed out.", "is-muted");
      window.location.href = loginUrl();
      return;
    }

    var auth = await loadAuth();
    if (auth.client) {
      await auth.client.auth.signOut();
    }
    queueLoginMessage("Signed out.", "is-muted");
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
      throw makeAuthError(friendlyError(result.error), "password_reset_error");
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
        setStatus(friendlyError(error), "is-error");
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
        setStatus(friendlyError(error), "is-error");
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
    consumeLoginMessage();

    if (allowLocalPreview()) {
      authReady = true;
      return;
    }

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
        setStatus(friendlyError(error) || "Unable to initialize authentication.", "is-error");
      } else if (allowLocalPreview()) {
        authReady = true;
        return;
      } else {
        redirectToLogin(friendlyError(error), "is-error");
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
    getCurrentProfile: function () {
      return currentProfile;
    },
    isReady: function () {
      return authReady;
    }
  };

  initializeAuth();
})();
