(function () {
  'use strict';

  /* =========================================================
     SUPABASE CONFIG
     ========================================================= */

  const configReady = () =>
      window.SUPABASE_URL &&
      !window.SUPABASE_URL.includes('PASTE_') &&
      window.SUPABASE_ANON_KEY &&
      !window.SUPABASE_ANON_KEY.includes('PASTE_');

  let client = null;
  let guide = null;
  let editorToken = null;
  let publicId = null;


  /* =========================================================
     ROUTING
     ========================================================= */

  function route() {
    const parts = location.pathname
        .replace(/^\/+|\/+$/g, '')
        .split('/')
        .filter(Boolean);

    // /edit/TOKEN
    if (parts[0] === 'edit' && parts[1]) {
      return {
        mode: 'edit',
        value: parts[1]
      };
    }

    // /g/PUBLIC_ID
    if (parts[0] === 'g' && parts[1]) {
      return {
        mode: 'guest',
        value: parts[1]
      };
    }

    const params = new URLSearchParams(location.search);

    // ?edit=TOKEN
    if (params.get('edit')) {
      return {
        mode: 'edit',
        value: params.get('edit')
      };
    }

    // ?guide=PUBLIC_ID
    if (params.get('guide')) {
      return {
        mode: 'guest',
        value: params.get('guide')
      };
    }

    return {
      mode: 'guest',
      value: null
    };
  }


  /* =========================================================
     SECURITY / HTML ESCAPING
     ========================================================= */

  function escapeHtml(value) {
    return String(value ?? '').replace(
        /[&<>'"]/g,
        c => ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          "'": '&#39;',
          '"': '&quot;'
        }[c])
    );
  }


  /* =========================================================
     TEXT HELPERS
     ========================================================= */

  function setText(id, value) {
    const el = document.getElementById(id);

    if (
        el &&
        value !== null &&
        value !== undefined
    ) {
      el.textContent = value;
    }
  }


  function setValue(id, value) {
    const el = document.getElementById(id);

    if (
        el &&
        value !== null &&
        value !== undefined
    ) {
      el.value = value;
    }
  }


  /* =========================================================
     APPLY GUIDE DATA TO GUEST PAGE
     ========================================================= */

  function applyGuide(g) {
    if (!g) return;


    /* ---------------------------------------------------------
       PROPERTY
       --------------------------------------------------------- */

    setText(
        'property-name',
        g.property_name || 'Welcome Home'
    );

    setText(
        'cover-location',
        g.address || 'Your destination'
    );

    setText(
        'welcome-property',
        g.property_name || 'Your Property'
    );

    setText(
        'welcome-address',
        g.address || ''
    );


    /* ---------------------------------------------------------
       WELCOME
       --------------------------------------------------------- */

    setText(
        'welcome-title',
        g.welcome_title || 'Welcome! 👋'
    );

    setText(
        'welcome-message',
        g.welcome_message || 'Welcome to your stay.'
    );

    setText(
        'dashboard-description',
        g.welcome_message ||
        'Everything you need for a comfortable stay.'
    );


    /* ---------------------------------------------------------
       ROOM / STAY DETAILS
       --------------------------------------------------------- */

    if (g.room) {
      setText('welcome-room', g.room);
    }

    if (g.room_number) {
      setText('welcome-room', g.room_number);
    }

    if (g.unit) {
      setText('welcome-room', g.unit);
    }

    if (g.unit_number) {
      setText('welcome-room', g.unit_number);
    }

    if (g.size) {
      setText('stay-size', g.size);
    }

    if (g.beds) {
      setText('stay-beds', g.beds);
    }

    if (g.bathrooms) {
      setText('stay-bathrooms', g.bathrooms);
    }

    if (g.bedrooms) {
      setText('stay-bedrooms', g.bedrooms);
    }

    if (g.stay_extra) {
      setText('stay-extra', g.stay_extra);
    }


    /* ---------------------------------------------------------
       CHECK-IN
       --------------------------------------------------------- */

    setText(
        'welcome-checkin-time',
        g.check_in || '2:00 PM'
    );


    /* ---------------------------------------------------------
       AIRPORT / LOBBY
       --------------------------------------------------------- */

    if (g.airport_transport) {
      setText(
          'airport-transport',
          g.airport_transport
      );
    }

    if (g.lobby_name) {
      setText(
          'lobby-name',
          g.lobby_name
      );
    }


    /* ---------------------------------------------------------
       GUIDE MESSAGE
       --------------------------------------------------------- */

    if (g.guide_message) {
      setText(
          'guide-message',
          g.guide_message
      );
    }


    /* ---------------------------------------------------------
       WIFI
       --------------------------------------------------------- */

    setText(
        'wifi-name',
        g.wifi_name || ''
    );

    setText(
        'wifi-pass',
        g.wifi_password || ''
    );


    /* ---------------------------------------------------------
       CONTACT
       --------------------------------------------------------- */

    setText(
        'host-name',
        g.host_name || ''
    );

    setText(
        'host-phone',
        g.host_phone || ''
    );


    /* ---------------------------------------------------------
       CHECK-OUT
       --------------------------------------------------------- */

    // Find checkout time in existing HTML
    const checkoutPage = document.getElementById('checkout');

    if (checkoutPage && g.check_out) {
      const checkoutTime = checkoutPage.querySelector(
          '.info-block strong'
      );

      if (checkoutTime) {
        checkoutTime.textContent = g.check_out;
      }
    }


    /* ---------------------------------------------------------
       GOOGLE MAPS
       --------------------------------------------------------- */

    if (g.google_maps_url) {
      document
          .querySelectorAll(
              'a[href*="google.com/maps"], a[href*="maps.app.goo.gl"]'
          )
          .forEach(a => {
            a.href = g.google_maps_url;
          });
    }


    /* ---------------------------------------------------------
       DYNAMIC AIRBNB / FACEBOOK / PHONE
       --------------------------------------------------------- */

    if (g.host_phone) {
      document
          .querySelectorAll('a[href^="tel:"]')
          .forEach(a => {
            const text = a.textContent.trim();

            if (
                text.includes('Host') ||
                text.includes('0995') ||
                text.includes('Phone')
            ) {
              a.href =
                  'tel:' +
                  g.host_phone.replace(/\s+/g, '');
            }
          });
    }
  }


  /* =========================================================
     SETUP ERROR
     ========================================================= */

  function showSetupError(message) {
    const existing =
        document.querySelector('.app-setup-error');

    if (existing) {
      existing.remove();
    }

    const box =
        document.createElement('div');

    box.className =
        'app-setup-error';

    box.innerHTML = `
      <strong>App setup needed</strong>
      <p>${escapeHtml(message)}</p>
    `;

    document.body.appendChild(box);
  }


  /* =========================================================
     LOAD GUEST GUIDE
     ========================================================= */

  async function loadGuest(id) {
    if (!id) return;

    try {
      const {
        data,
        error
      } = await client
          .from('guides')
          .select('*')
          .eq('public_id', id)
          .eq('published', true)
          .maybeSingle();

      if (error) {
        showSetupError(error.message);
        return;
      }

      if (!data) {
        showSetupError(
            'This guest guide does not exist or has not been published yet.'
        );
        return;
      }

      guide = data;
      publicId = id;

      applyGuide(data);

    } catch (error) {
      showSetupError(
          'Unable to load the guest guide.'
      );

      console.error(error);
    }
  }


  /* =========================================================
     LOAD EDITOR
     ========================================================= */

  async function loadEditor(token) {
    try {
      const {
        data,
        error
      } = await client.rpc(
          'get_guide_for_editor',
          {
            p_edit_token: token
          }
      );

      if (error) {
        showSetupError(
            'Editor could not be opened: ' +
            error.message
        );

        return;
      }

      guide =
          Array.isArray(data)
              ? data[0]
              : data;

      if (!guide) {
        showSetupError(
            'This editing link is invalid or expired.'
        );

        return;
      }

      editorToken = token;
      publicId = guide.public_id;

      applyGuide(guide);

      createEditor();

    } catch (error) {
      console.error(error);

      showSetupError(
          'Unable to open the editor.'
      );
    }
  }


  /* =========================================================
     CREATE EDITOR PANEL
     ========================================================= */

  function createEditor() {
    if (
        document.getElementById(
            'editor-panel'
        )
    ) {
      return;
    }

    document.body.classList.add(
        'editor-mode'
    );

    const panel =
        document.createElement('aside');

    panel.id =
        'editor-panel';

    panel.innerHTML = `

      <div class="editor-topbar">

        <div>
          <span class="editor-kicker">
            CLIENT EDITOR
          </span>

          <h2>
            Welcome Guide
          </h2>
        </div>

        <button
          id="close-editor"
          class="editor-close"
          title="Close editor"
          type="button"
        >
          ×
        </button>

      </div>


      <div
        class="editor-status"
        id="editor-status"
      >
        Editing your guide
      </div>


      <div class="editor-tabs">

        <button
          class="editor-tab active"
          data-tab="welcome"
          type="button"
        >
          Welcome
        </button>

        <button
          class="editor-tab"
          data-tab="stay"
          type="button"
        >
          Stay Details
        </button>

        <button
          class="editor-tab"
          data-tab="contact"
          type="button"
        >
          Contact
        </button>

      </div>


      <div class="editor-body">


        <!-- ================= WELCOME ================= -->

        <section
          class="editor-section active"
          data-section="welcome"
        >

          <label>
            Property name

            <input
              id="e-property_name"
              type="text"
              autocomplete="off"
            >
          </label>


          <label>
            Welcome title

            <input
              id="e-welcome_title"
              type="text"
              autocomplete="off"
            >
          </label>


          <label>
            Welcome message

            <textarea
              id="e-welcome_message"
              rows="4"
            ></textarea>
          </label>


          <label>
            Address

            <textarea
              id="e-address"
              rows="3"
            ></textarea>
          </label>


          <label>
            Google Maps link

            <input
              id="e-google_maps_url"
              type="url"
              placeholder="https://maps.google.com/..."
            >
          </label>

        </section>


        <!-- ================= STAY ================= -->

        <section
          class="editor-section"
          data-section="stay"
        >

          <label>
            Check-in

            <input
              id="e-check_in"
              type="text"
              placeholder="2:00 PM"
            >
          </label>


          <label>
            Check-out

            <input
              id="e-check_out"
              type="text"
              placeholder="11:00 AM"
            >
          </label>


          <label>
            Wi-Fi name

            <input
              id="e-wifi_name"
              type="text"
              autocomplete="off"
            >
          </label>


          <label>
            Wi-Fi password

            <input
              id="e-wifi_password"
              type="text"
              autocomplete="off"
            >
          </label>

        </section>


        <!-- ================= CONTACT ================= -->

        <section
          class="editor-section"
          data-section="contact"
        >

          <label>
            Host name

            <input
              id="e-host_name"
              type="text"
              autocomplete="off"
            >
          </label>


          <label>
            Host phone

            <input
              id="e-host_phone"
              type="text"
              autocomplete="off"
            >
          </label>

        </section>

      </div>


      <div class="editor-actions">

        <button
          id="save-guide"
          class="save-guide"
          type="button"
        >
          Save Changes
        </button>


        <button
          id="guest-preview"
          class="secondary-action"
          type="button"
        >
          Preview Guest
        </button>


        <button
          id="copy-link"
          class="secondary-action"
          type="button"
        >
          Copy Guest Link
        </button>

      </div>

    `;

    document.body.appendChild(panel);


    /* =======================================================
       LOAD CURRENT VALUES INTO EDITOR
       ======================================================= */

    const fields = [
      'property_name',
      'welcome_title',
      'welcome_message',
      'address',
      'google_maps_url',
      'check_in',
      'check_out',
      'wifi_name',
      'wifi_password',
      'host_name',
      'host_phone'
    ];


    fields.forEach(key => {

      const input =
          document.getElementById(
              'e-' + key
          );

      if (!input) return;

      input.value =
          guide[key] || '';

    });


    /* =======================================================
       TABS
       ======================================================= */

    panel
        .querySelectorAll(
            '.editor-tab'
        )
        .forEach(button => {

          button.addEventListener(
              'click',
              () => {

                panel
                    .querySelectorAll(
                        '.editor-tab'
                    )
                    .forEach(btn =>
                        btn.classList.remove(
                            'active'
                        )
                    );


                panel
                    .querySelectorAll(
                        '.editor-section'
                    )
                    .forEach(section =>
                        section.classList.remove(
                            'active'
                        )
                    );


                button.classList.add(
                    'active'
                );


                const target =
                    panel.querySelector(
                        `[data-section="${button.dataset.tab}"]`
                    );


                if (target) {
                  target.classList.add(
                      'active'
                  );
                }

              }
          );

        });


    /* =======================================================
       CLOSE EDITOR
       ======================================================= */

    document
        .getElementById(
            'close-editor'
        )
        .onclick = () => {

      panel.remove();

      document.body.classList.remove(
          'editor-mode'
      );

    };


    /* =======================================================
       SAVE
       ======================================================= */

    document
        .getElementById(
            'save-guide'
        )
        .onclick = saveGuide;


    /* =======================================================
       PREVIEW
       ======================================================= */

    document
        .getElementById(
            'guest-preview'
        )
        .onclick = () => {

      if (!publicId) {
        setStatus(
            'Guest guide ID is missing.',
            false
        );

        return;
      }

      window.open(
          '/g/' +
          encodeURIComponent(publicId),
          '_blank'
      );

    };


    /* =======================================================
       COPY GUEST LINK
       ======================================================= */

    document
        .getElementById(
            'copy-link'
        )
        .onclick = async () => {

      if (!publicId) {
        setStatus(
            'Guest guide ID is missing.',
            false
        );

        return;
      }

      try {

        const url =
            new URL(
                '/g/' + publicId,
                location.origin
            ).href;


        await navigator.clipboard.writeText(
            url
        );


        setStatus(
            'Guest link copied!'
        );

      } catch (error) {

        console.error(error);

        setStatus(
            'Unable to copy the guest link.',
            false
        );

      }

    };

  }


  /* =========================================================
     EDITOR STATUS
     ========================================================= */

  function setStatus(
      message,
      good = true
  ) {

    const el =
        document.getElementById(
            'editor-status'
        );

    if (!el) return;

    el.textContent =
        message;

    el.classList.toggle(
        'error',
        !good
    );

  }


  /* =========================================================
     SAVE GUIDE
     ========================================================= */

  async function saveGuide() {

    const fields = [
      'property_name',
      'welcome_title',
      'welcome_message',
      'address',
      'google_maps_url',
      'check_in',
      'check_out',
      'wifi_name',
      'wifi_password',
      'host_name',
      'host_phone'
    ];


    const values = {};


    fields.forEach(key => {

      const input =
          document.getElementById(
              'e-' + key
          );

      values[key] =
          input &&
          input.value.trim()
              ? input.value.trim()
              : null;

    });


    const button =
        document.getElementById(
            'save-guide'
        );


    if (!button) return;


    button.disabled = true;
    button.textContent = 'Saving…';


    setStatus(
        'Saving changes…'
    );


    try {

      const {
        data,
        error
      } = await client.rpc(
          'update_guide_by_token',
          {
            p_edit_token: editorToken,
            p_changes: values
          }
      );


      if (error) {

        button.disabled = false;
        button.textContent =
            'Save Changes';

        setStatus(
            'Could not save: ' +
            error.message,
            false
        );

        return;
      }


      guide =
          Array.isArray(data)
              ? data[0]
              : data;


      applyGuide(
          guide || values
      );


      button.disabled = false;
      button.textContent =
          'Save Changes';


      setStatus(
          'Saved successfully ✓'
      );


    } catch (error) {

      console.error(error);

      button.disabled = false;
      button.textContent =
          'Save Changes';


      setStatus(
          'Could not save changes.',
          false
      );

    }

  }


  /* =========================================================
     INITIALIZE
     ========================================================= */

  async function init() {

    const r = route();


    /* ---------------------------------------------------------
       CHECK SUPABASE CONFIG
       --------------------------------------------------------- */

    if (!configReady()) {

      if (r.mode === 'edit') {

        showSetupError(
            'Open supabase-config.js and add your Supabase Project URL and anon key.'
        );

      }

      return;
    }


    /* ---------------------------------------------------------
       CREATE SUPABASE CLIENT
       --------------------------------------------------------- */

    try {

      client =
          window.supabase.createClient(
              window.SUPABASE_URL,
              window.SUPABASE_ANON_KEY
          );

    } catch (error) {

      console.error(error);

      showSetupError(
          'Unable to initialize Supabase.'
      );

      return;
    }


    /* ---------------------------------------------------------
       ROUTE
       --------------------------------------------------------- */

    if (
        r.mode === 'edit'
    ) {

      await loadEditor(
          r.value
      );

    } else if (
        r.mode === 'guest' &&
        r.value
    ) {

      await loadGuest(
          r.value
      );

    }

  }


  /* =========================================================
     START
     ========================================================= */

  document.addEventListener(
      'DOMContentLoaded',
      init
  );

})();