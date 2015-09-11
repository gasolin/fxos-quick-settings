(function () {

  // Borrowed from shared/js/settings_listener.js
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


  var QuickSettings = {
    _elements: {},
    supportItems: ['nfc', 'volume', 'flashlight', 'hotspot',
                  'orientation', 'powersave', 'location', 'ums',
                  'developer'],
    workingItems: [],

    initialize: function initialize() {
      this._elements = {
        quickSettingsContainer: document.querySelector('#quick-settings > ul'),
        lastButton: document.querySelector('#quick-settings-full-app').parentNode
      };

      this.workingItems = this.supportItems;

      var KEY = 'quick.settings.addon';
      var settings = window.navigator.mozSettings;
      var req = settings.createLock().get(KEY);
      req.onsccess = () => {
        var result = req.result[KEY];
        if (typeof result === 'undefined') {
          console.log('initial to default');
          this.workingItems = this.supportItems;
        } else {
          this.workingItems = result
        }
      };
      req.onerror = () => {
        console.log('Error fail to get settings');
        this.workingItems = this.supportItems;
      };

      this.renderItems();
    },

    renderItems: function renderItems() {
      this._elements.quickSettingsContainer.style.flexWrap = 'wrap';

      // Remove previously appended buttons if any
      while (this._elements.lastButton.nextSibling) {
        this._elements.quickSettingsContainer.removeChild(
          this._elements.lastButton.nextSibling);
      }

      var availableItems = {
        'nfc': this.initNfcButton,
        'volume': this.initVolumeButton,
        'flashlight': this.initFlashButton,
        'hotspot': this.initHotSpotButton,
        'orientation': this.initOrientationButton,
        'powersave': this.initPowersaveButton,
        'location': this.initLocationButton,
        'ums': this.initUmsButton,
        'developer': this.initDeveloperButton,
        'config': this.initConfigButton.bind(this)
      };

      if (this.workingItems.indexOf('config') < 0) {
        this.workingItems.push('config');
      }

      var btn = null;
      this.workingItems.forEach((item) => {
        btn = this.createButton(item);
        availableItems[item].call(this, btn.firstChild);
        this._elements.quickSettingsContainer.appendChild(btn);
      });

      // Add additional li as placeholders to layout buttons correctly
      var fillLi = 5 - this.workingItems.length % 5;
      for (i=0; i < fillLi; i++) {
        this._elements.quickSettingsContainer.appendChild(
          document.createElement('li'));
      }

      var allSettings = document.querySelectorAll('#quick-settings > ul > li');
      for (var i=0; i < allSettings.length; i++) {
        allSettings[i].style.flex = '1 1 20%';
      }
    },

    // Template:
    // <li><a href="#" id="quick-settings-wifi" class="icon bb-button" data-icon="wifi-4" data-enabled="false" role="button" data-l10n-id="quick-settings-wifiButton-off"></a></li>
    createButton: function createButton(name) {
      var li = document.createElement('li');
      var a = document.createElement('a');
      a.href = '#';
      a.id = 'quick-settings-' + name;
      a.classList.add('icon');
      a.classList.add('bb-button');
      a.setAttribute('role', 'button');
      li.appendChild(a);

      return li;
    },

    initVolumeButton: function initVolumeButton(button) {
      var originalVolume = 0;

      function onVolumeChanged(value) {
        if (value > 14) {
          button.dataset.icon = 'sound-max';
          button.dataset.l10nId = 'quick-settings-volumeButton-max';
        } else if (value < 1) {
          button.dataset.icon = 'mute';
          button.dataset.l10nId = 'quick-settings-volumeButton-mute';
        } else {
          button.dataset.icon = 'sound-min';
          button.dataset.l10nId = 'quick-settings-volumeButton-min';
        }

        originalVolume = value > 0 ? value : originalVolume;
      }

      function onClick() {
        if (button.dataset.icon === 'mute') {
          window.navigator.mozSettings.createLock().set({'audio.volume.notification': originalVolume});
        } else {
          window.navigator.mozSettings.createLock().set({'audio.volume.notification': 0});
        }
      }

      button.dataset.icon = 'sound-max';
      // button.dataset.enabled = false;
      button.dataset.l10nId = 'quick-settings-volumeButton-max';
      button.addEventListener('click', onClick);

      SettingsListener.observe('audio.volume.notification', '', onVolumeChanged);
    },

    initNfcButton: function initNfcButton(button) {

      function onNfcStatusChanged(status) {
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

      function onClick() {
        if (button.dataset.enabled === 'true') {
          window.navigator.mozSettings.createLock().set({'nfc.enabled': false});
        } else {
          window.navigator.mozSettings.createLock().set({'nfc.enabled': true});
        }
      }

      button.dataset.icon = 'nfc';
      button.dataset.enabled = false;
      button.dataset.l10nId = 'quick-settings-nfcButton-off';
      button.addEventListener('click', onClick);

      SettingsListener.observe('nfc.status', undefined, onNfcStatusChanged);
    },

    initFlashButton: function initFlashButton(button) {

      var options = {
        mode: 'video'
      };

      var cameraId = window.navigator.mozCameras.getListOfCameras()[0];
      var mozCamera;

      // need to check if the current app uses camera or not, show an error toast if yes

      // need to release camera when the screen is on after it went black

      // before getCamera, need to check if any app other than the current app occupies the camera,
      // release the camera if yes

      function onClick () {
        console.log('onClick', button.dataset.enabled);
        if (button.dataset.enabled === 'true') {
          console.log('release camera');
          mozCamera.release();

          button.dataset.icon = 'flash-off';
          button.dataset.enabled = false;
          button.dataset.l10nId = 'quick-settings-flashlightButton-off';
        } else {
          console.log('get camera');
          window.navigator.mozCameras.getCamera(cameraId, options)
          .then(function (result) {
            console.log('set flash on');
            mozCamera = result.camera;
            mozCamera.flashMode = 'torch';
          }, function (error) {
            console.log(error);
          }).catch(function (e) {
            console.log('catch', e);
          });

          button.dataset.icon = 'flash-on';
          button.dataset.enabled = true;
          button.dataset.l10nId = 'quick-settings-flashlightButton-on';
        }
      }

      button.dataset.icon = 'flash-off';
      button.dataset.enabled = false;
      button.dataset.l10nId = 'quick-settings-flashlightButton-off';
      button.addEventListener('click', onClick);
    },

    initHotSpotButton: function initHotSpotButton(button) {

      function onHotSpotStatusChanged(status) {
        if (status) {
          button.style.color = '#008EAB';
          button.dataset.enabled = true;
          button.dataset.l10nId = 'quick-settings-hotSpotButton-on';
        } else {
          button.style.color = '';
          button.dataset.enabled = false;
          button.dataset.l10nId = 'quick-settings-hotSpotButton-off';
        }
      }

      function onClick() {
        if (button.dataset.enabled === 'true') {
          window.navigator.mozSettings.createLock().set({'tethering.wifi.enabled': false});
        } else {
          window.navigator.mozSettings.createLock().set({'tethering.wifi.enabled': true});
        }
      }

      button.dataset.icon = 'tethering';
      button.dataset.enabled = false;
      button.dataset.l10nId = 'quick-settings-hotspotButton-off';
      button.addEventListener('click', onClick);

      SettingsListener.observe('tethering.wifi.enabled', false, onHotSpotStatusChanged);
    },

    initOrientationButton: function initOrientationButton(button) {

      function onOrientationStatusChanged(status) {
        if (status) {
          button.style.color = '#008EAB';
          button.dataset.enabled = true;
          button.dataset.l10nId = 'quick-settings-orientButton-on';
        } else {
          button.style.color = '';
          button.dataset.enabled = false;
          button.dataset.l10nId = 'quick-settings-orientButton-off';
        }
      }

      function onClick() {
        if (button.dataset.enabled === 'true') {
          window.navigator.mozSettings.createLock().set({'screen.orientation.lock': false});
        } else {
          window.navigator.mozSettings.createLock().set({'screen.orientation.lock': true});
        }
      }

      button.dataset.icon = 'toggle-camera-front';
      button.dataset.enabled = false;
      button.dataset.l10nId = 'quick-settings-orientationButton-off';
      button.addEventListener('click', onClick);

      SettingsListener.observe('screen.orientation.lock', false, onOrientationStatusChanged);
    },

    initPowersaveButton: function initPowersaveButton(button) {

      function onPowersaveStatusChanged(status) {
        if (status) {
          button.style.color = '#008EAB';
          button.dataset.enabled = true;
          button.dataset.l10nId = 'quick-settings-powersaveButton-on';
        } else {
          button.style.color = '';
          button.dataset.enabled = false;
          button.dataset.l10nId = 'quick-settings-powersaveButton-off';
        }
      }

      function onClick() {
        if (button.dataset.enabled === 'true') {
          window.navigator.mozSettings.createLock().set({'powersave.enabled': false});
        } else {
          window.navigator.mozSettings.createLock().set({'powersave.enabled': true});
        }
      }

      button.dataset.icon = 'battery-3';
      button.dataset.enabled = false;
      button.dataset.l10nId = 'quick-settings-powersaveButton-off';
      button.addEventListener('click', onClick);

      SettingsListener.observe('powersave.enabled', false, onPowersaveStatusChanged);
    },

    initLocationButton: function initLocationButton(button) {

      function onLocationStatusChanged(status) {
        if (status) {
          button.style.color = '#008EAB';
          button.dataset.enabled = true;
          button.dataset.l10nId = 'quick-settings-locationButton-on';
        } else {
          button.style.color = '';
          button.dataset.enabled = false;
          button.dataset.l10nId = 'quick-settings-locationButton-off';
        }
      }

      function onClick() {
        if (button.dataset.enabled === 'true') {
          window.navigator.mozSettings.createLock().set({'geolocation.enabled': false});
        } else {
          window.navigator.mozSettings.createLock().set({'geolocation.enabled': true});
        }
      }

      button.dataset.icon = 'location';
      button.dataset.enabled = false;
      button.dataset.l10nId = 'quick-settings-locationButton-off';
      button.addEventListener('click', onClick);

      SettingsListener.observe('geolocation.enabled', false, onLocationStatusChanged);
    },

    initUmsButton: function initUmsButton(button) {

      function onLocationStatusChanged(status) {
        if (status) {
          button.style.color = '#008EAB';
          button.dataset.enabled = true;
          button.dataset.l10nId = 'quick-settings-umsButton-on';
        } else {
          button.style.color = '';
          button.dataset.enabled = false;
          button.dataset.l10nId = 'quick-settings-umsButton-off';
        }
      }

      function onClick() {
        if (button.dataset.enabled === 'true') {
          window.navigator.mozSettings.createLock().set({'ums.enabled': false});
        } else {
          window.navigator.mozSettings.createLock().set({'ums.enabled': true});
        }
      }

      button.dataset.icon = 'usb';
      button.dataset.enabled = false;
      button.dataset.l10nId = 'quick-settings-umsButton-off';
      button.addEventListener('click', onClick);

      SettingsListener.observe('ums.enabled', false, onLocationStatusChanged);
    },

    initDeveloperButton: function initDeveloperButton(button) {
      function onClick() {
        new MozActivity({
          name: 'configure',
          data: {
            target: 'device',
            section: 'developer'
          }
        });
      }

      button.dataset.icon = 'bug';
      button.dataset.enabled = false;
      button.dataset.l10nId = 'quick-settings-developerButton-off';
      button.addEventListener('click', onClick);
    },

    initConfigButton: function initConfigButton(button) {
      function onClick() {
        var activity = new MozActivity({
          name: 'configure',
          data: {
            target: 'user'
          }
        });

        activity.onsuccess = () => {
          console.log("XXX Activity successfuly handled", activity);
          this.renderItems();
        };

        activity.onerror = function() {
          console.log("The activity encouter en error: " + this.error);
        };
      }

      button.dataset.icon = 'addons';
      button.dataset.enabled = false;
      button.dataset.l10nId = 'quick-settings-configButton-off';
      button.addEventListener('click', onClick.bind(this));
    }
  };

  // If injecting into an app that was already running at the time
  // the app was enabled, simply initialize it.
  if (document.documentElement) {
    QuickSettings.initialize();
  } else {
    // Otherwise, we need to wait for the DOM to be ready before
    // starting initialization since add-ons are usually (always?)
    // injected *before* `document.documentElement` is defined.
    window.addEventListener('DOMContentLoaded', QuickSettings.initialize);
  }
}());
