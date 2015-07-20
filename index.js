(function () {

  // borrowed from shared/js/settings_listener.js
  var SettingsListener = {
    /* lock stores here */
    _lock: null,

    /* keep record of observers in order to remove them in the future */
    _observers: [],

    /**
     * getSettingsLock: create a lock or retrieve one that we saved.
     * mozSettings.createLock() is expensive and lock should be reused
     * whenever possible.
     */
    getSettingsLock: function sl_getSettingsLock() {
      // If there is a lock present we return that
      if (this._lock && !this._lock.closed) {
        return this._lock;
      }

      // If there isn't we return one.
      var settings = window.navigator.mozSettings;

      return (this._lock = settings.createLock());
    },

    observe: function sl_observe(name, defaultValue, callback) {
      var settings = window.navigator.mozSettings;
      if (!settings) {
        window.setTimeout(function() { callback(defaultValue); });
        return;
      }

      var req;
      try {
        req = this.getSettingsLock().get(name);
      } catch (e) {
        // It is possible (but rare) for getSettingsLock() to return
        // a SettingsLock object that is no longer valid.
        // Until https://bugzilla.mozilla.org/show_bug.cgi?id=793239
        // is fixed, we just catch the resulting exception and try
        // again with a fresh lock
        console.warn('Stale lock in settings_listener.js.',
                     'See https://bugzilla.mozilla.org/show_bug.cgi?id=793239');
        this._lock = null;
        req = this.getSettingsLock().get(name);
      }

      req.addEventListener('success', (function onsuccess() {
        callback(typeof(req.result[name]) != 'undefined' ?
          req.result[name] : defaultValue);
      }));

      var settingChanged = function settingChanged(evt) {
        callback(evt.settingValue);
      };
      settings.addObserver(name, settingChanged);
      this._observers.push({
        name: name,
        callback: callback,
        observer: settingChanged
      });
    },

    unobserve: function sl_unobserve(name, callback) {
      var settings = window.navigator.mozSettings;
      var that = this;
      this._observers.forEach(function(value, index) {
        if (value.name === name && value.callback === callback) {
          settings.removeObserver(name, value.observer);
          that._observers.splice(index, 1);
        }
      });
    }
  };

  // If injecting into an app that was already running at the time
  // the app was enabled, simply initialize it.
  if (document.documentElement) {
    initialize();
  }

  // Otherwise, we need to wait for the DOM to be ready before
  // starting initialization since add-ons are usually (always?)
  // injected *before* `document.documentElement` is defined.
  else {
    window.addEventListener('DOMContentLoaded', initialize);
  }

  // var SettingsListener = window.wrappedJSObject.SettingsListener;

  function initialize() {

    // console.log('init quick settings');
    // console.log('SettingsListener', window.wrappedJSObject.SettingsListener);

    // // Borrow some code from Gaia shared/js/settings_listener.js
    // var _lock;
    // function sl_getSettingsLock() {
    //   if (_lock && !_lock.closed) { return _lock; }
    //   var settings = window.navigator.mozSettings;
    //   return (_lock = settings.createLock());
    // }

    // // Wire up an event listener to set brightness on slider change.
    // var sliderEl = $$('quick-brightness-control');
    // sliderEl.addEventListener('change', function (ev) {
    //   sl_getSettingsLock().set({
    //     'screen.brightness': sliderEl.value
    //   });
    // });

    //

    var quickSettingsContainer = document.querySelector('#quick-settings > ul');
    quickSettingsContainer.style.flexWrap = 'wrap';

    // Remove previously appended buttons if any
    var lastButton = document.querySelector('#quick-settings-full-app').parentNode;
    while (lastButton.nextSibling) {
      quickSettingsContainer.removeChild(lastButton.nextSibling);
    }

    // Template:
    // <li><a href="#" id="quick-settings-wifi" class="icon bb-button" data-icon="wifi-4" data-enabled="false" role="button" data-l10n-id="quick-settings-wifiButton-off"></a></li>
    var settings = {
      volume: createButton('volume'),
      nfc: createButton('nfc'),
      flashlight: createButton('flashlight')
    };

    settings.volume.firstChild.dataset.icon = 'sound-max';
    settings.volume.firstChild.dataset.enabled = true;
    settings.volume.firstChild.dataset.l10nId = 'quick-settings-volumeButton-max';
    // settings.nfc.firstChild.dataset.icon = 'nfc';
    // settings.nfc.firstChild.dataset.enabled = false;
    // settings.nfc.firstChild.dataset.l10nId = 'quick-settings-nfcButton-off';
    initNfc(settings.nfc.firstChild);

    settings.flashlight.firstChild.dataset.icon = 'flash-off';
    settings.flashlight.firstChild.dataset.enabled = false;
    settings.flashlight.firstChild.dataset.l10nId = 'quick-settings-flashlightButton-off';

    for (var prop in settings) {
      quickSettingsContainer.appendChild(settings[prop]);
    }

    // XXX: Add 2 additional li as placeholders to layout buttons correctly
    quickSettingsContainer.appendChild(document.createElement('li'));
    quickSettingsContainer.appendChild(document.createElement('li'));

    var allSettings = document.querySelectorAll('#quick-settings > ul > li');
    for (var i=0; i < allSettings.length; i++) {
      allSettings[i].style.flex = '1 1 20%';
    }

  }

  function createButton (name) {
    var li = document.createElement('li');
    var a = document.createElement('a');
    a.href = '#';
    a.id = 'quick-settings-' + name;
    a.classList.add('icon');
    a.classList.add('bb-button');
    // a.dataset.icon = name;
    a.setAttribute('role', 'button');
    li.appendChild(a);

    return li;
  }

  function initNfc (button) {

    function onNfcStatusChanged (status) {
      console.log('onNfcStatusChanged', status);
      if (status === 'enabling' || status === 'enabled') {
        button.style.color = '#008EAB';
        button.dataset.enabled = true;
        button.dataset.l10nId = 'quick-settings-nfcButton-on';
      } else if (status === 'disabling' || status === 'disabled') {
        button.style.color = '';
        button.dataset.enabled = false;
        button.dataset.l10nId = 'quick-settings-nfcButton-off';
      }
    }

    button.dataset.icon = 'nfc';
    button.dataset.enabled = false;
    button.dataset.l10nId = 'quick-settings-nfcButton-off';

    SettingsListener.observe('nfc.status', undefined, onNfcStatusChanged);
  }

}());
