
/* =====================================================
   SCHOOL FACE ATTENDANCE SYSTEM
   APP.JS — VERSION 1
   Camera preview + Supabase staff authentication
===================================================== */

(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);

  let supabaseClient = null;
  let cameraStream = null;

  const CONFIG_KEY = "sfa_supabase_config";

  // -----------------------------------------------
  // STATUS MESSAGES
  // -----------------------------------------------

  function showMessage(id, message, type = "") {
    const element = $(id);

    if (!element) return;

    element.textContent = message;
    element.className = "message";

    if (type) {
      element.classList.add(type);
    }
  }

  // -----------------------------------------------
  // SUPABASE CONFIGURATION
  // -----------------------------------------------

  function initializeSupabase() {
    const savedConfig = localStorage.getItem(CONFIG_KEY);

    if (!savedConfig) {
      showMessage(
        "loginMessage",
        "Supabase has not been configured yet."
      );

      return false;
    }

    try {
      const config = JSON.parse(savedConfig);

      if (!config.url || !config.key) {
        throw new Error("Invalid Supabase configuration.");
      }

      if (!window.supabase) {
        throw new Error(
          "Supabase library failed to load. Check your internet connection."
        );
      }

      supabaseClient = window.supabase.createClient(
        config.url,
        config.key,
        {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true
          }
        }
      );

      return true;
    } catch (error) {
      console.error("Supabase initialization error:", error);

      showMessage(
        "loginMessage",
        error.message,
        "error"
      );

      return false;
    }
  }

  // -----------------------------------------------
  // CAMERA
  // -----------------------------------------------

  async function startCamera() {
    const video = $("cameraVideo");
    const placeholder = $("cameraPlaceholder");
    const startButton = $("startCameraBtn");
    const stopButton = $("stopCameraBtn");
    const status = $("cameraStatus");

    if (cameraStream) return;

    if (!navigator.mediaDevices?.getUserMedia) {
      showMessage(
        "cameraMessage",
        "Camera unavailable. Open this website through HTTPS and allow camera access.",
        "error"
      );

      return;
    }

    try {
      showMessage(
        "cameraMessage",
        "Requesting camera permission..."
      );

      cameraStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "user" },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });

      video.srcObject = cameraStream;
      video.style.display = "block";

      await video.play();

      placeholder.classList.add("hidden");

      status.textContent = "Camera On";
      startButton.disabled = true;
      stopButton.disabled = false;

      showMessage(
        "cameraMessage",
        "Camera connected. No video or face image is uploaded.",
        "success"
      );

    } catch (error) {
      console.error("Camera error:", error);

      showMessage(
        "cameraMessage",
        "Unable to open camera. Check browser permissions and HTTPS access.",
        "error"
      );

      stopCamera();
    }
  }

  function stopCamera() {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => {
        track.stop();
      });

      cameraStream = null;
    }

    const video = $("cameraVideo");

    if (video) {
      video.pause();
      video.srcObject = null;
      video.style.display = "none";
    }

    $("cameraPlaceholder")?.classList.remove("hidden");

    if ($("cameraStatus")) {
      $("cameraStatus").textContent = "Camera Off";
    }

    if ($("startCameraBtn")) {
      $("startCameraBtn").disabled = false;
    }

    if ($("stopCameraBtn")) {
      $("stopCameraBtn").disabled = true;
    }

    showMessage(
      "cameraMessage",
      "Camera stopped."
    );
  }

  $("startCameraBtn")?.addEventListener(
    "click",
    startCamera
  );

  $("stopCameraBtn")?.addEventListener(
    "click",
    stopCamera
  );

  // Stop the camera when the page is being left.
  window.addEventListener("pagehide", stopCamera);

  // -----------------------------------------------
  // STAFF LOGIN
  // -----------------------------------------------

  async function loginStaff(event) {
    event.preventDefault();

    if (!supabaseClient) {
      showMessage(
        "loginMessage",
        "Supabase is not configured. Configure your project before signing in.",
        "error"
      );

      return;
    }

    const email = $("email").value.trim();
    const password = $("password").value;
    const submitButton = event.submitter;

    if (submitButton) {
      submitButton.disabled = true;
    }

    showMessage(
      "loginMessage",
      "Signing in..."
    );

    try {
      const { data, error } =
        await supabaseClient.auth.signInWithPassword({
          email,
          password
        });

      if (error) throw error;

      if (!data.user) {
        throw new Error("Unable to verify the account.");
      }

      // Authentication alone does not grant staff access.
      const { data: profile, error: profileError } =
        await supabaseClient
          .from("sfa_profiles")
          .select("display_name, role")
          .eq("id", data.user.id)
          .maybeSingle();

      if (profileError) throw profileError;

      if (
        !profile ||
        !["admin", "teacher"].includes(profile.role)
      ) {
        await supabaseClient.auth.signOut();

        throw new Error(
          "Access denied. An authorized school staff profile is required."
        );
      }

      showMessage(
        "loginMessage",
        `Signed in successfully as ${profile.display_name || data.user.email}.`,
        "success"
      );

      // Dashboard data and attendance actions will be connected
      // in the next development step.
      console.info(
        "Authorized staff session established:",
        profile.role
      );

    } catch (error) {
      console.error("Login error:", error);

      showMessage(
        "loginMessage",
        error.message || "Sign-in failed.",
        "error"
      );

    } finally {
      if (submitButton) {
        submitButton.disabled = false;
      }
    }
  }

  $("loginForm")?.addEventListener(
    "submit",
    loginStaff
  );

  // -----------------------------------------------
  // RESTORE EXISTING SESSION
  // -----------------------------------------------

  async function restoreSession() {
    if (!supabaseClient) return;

    try {
      const { data, error } =
        await supabaseClient.auth.getSession();

      if (error) throw error;

      if (data.session?.user) {
        console.info(
          "An existing Supabase session was found."
        );

        // A future step will restore the authorized
        // staff dashboard after checking the profile.
      }

    } catch (error) {
      console.error(
        "Session restoration error:",
        error
      );
    }
  }

  // -----------------------------------------------
  // INITIALIZE APPLICATION
  // -----------------------------------------------

  function initializeApp() {
    const connected = initializeSupabase();

    if (connected) {
      restoreSession();
    }

    console.info(
      "School Face Attendance System initialized."
    );
  }

  initializeApp();

})();
