(function () {
  "use strict";

  var scriptElement = document.currentScript;
  var localConfigUrl = new URL("config.js", scriptElement ? scriptElement.src : window.location.href).href;
  var supabaseBrowserClientUrl = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
  var clientPromise = null;
  var configLoaded = false;

  function hasPlaceholder(value) {
    return !value || /YOUR_PROJECT_REF|YOUR_SUPABASE_PUBLISHABLE_KEY/i.test(String(value));
  }

  function getConfigStatus() {
    var url = window.LIBERTY_BLUE_SUPABASE_URL;
    var key = window.LIBERTY_BLUE_SUPABASE_ANON_KEY;
    var missing = [];

    if (hasPlaceholder(url)) {
      missing.push("LIBERTY_BLUE_SUPABASE_URL");
    }
    if (hasPlaceholder(key)) {
      missing.push("LIBERTY_BLUE_SUPABASE_ANON_KEY");
    }

    return {
      isConfigured: missing.length === 0,
      missing: missing,
      url: url || "",
      anonKey: key || "",
      message: missing.length
        ? "Supabase is not configured. Create js/config.js from js/config.example.js with the Liberty Blue project URL and publishable key."
        : ""
    };
  }

  function loadScript(src, optional) {
    return new Promise(function (resolve, reject) {
      var existing = Array.from(document.scripts).find(function (script) {
        return script.src === src;
      });

      if (existing && existing.getAttribute("data-loaded") === "true") {
        resolve();
        return;
      }

      var script = existing || document.createElement("script");
      script.src = src;
      script.async = false;
      script.onload = function () {
        script.setAttribute("data-loaded", "true");
        resolve();
      };
      script.onerror = function () {
        if (optional) {
          resolve();
          return;
        }
        reject(new Error("Unable to load the Supabase browser client."));
      };

      if (!existing) {
        document.head.appendChild(script);
      }
    });
  }

  async function loadLocalConfig() {
    if (configLoaded) {
      return;
    }
    configLoaded = true;
    await loadScript(localConfigUrl, true);
  }

  async function loadClient() {
    if (clientPromise) {
      return clientPromise;
    }

    clientPromise = (async function () {
      await loadLocalConfig();
      var config = getConfigStatus();

      if (!config.isConfigured) {
        return {
          client: null,
          config: config,
          error: null
        };
      }

      if (!window.supabase || typeof window.supabase.createClient !== "function") {
        await loadScript(supabaseBrowserClientUrl, false);
      }

      if (!window.supabase || typeof window.supabase.createClient !== "function") {
        throw new Error("Supabase browser client is unavailable.");
      }

      return {
        client: window.supabase.createClient(config.url, config.anonKey, {
          auth: {
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: true
          }
        }),
        config: config,
        error: null
      };
    })();

    return clientPromise;
  }

  window.LibertyBlueSupabase = {
    getConfigStatus: getConfigStatus,
    isConfigured: function () {
      return getConfigStatus().isConfigured;
    },
    loadClient: loadClient
  };
})();
