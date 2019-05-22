'use strict';

import {
  createObjectFromKeys
} from '../common/utilities.js';

import {
  EventListener,
  EventManager,
  PassthroughEventManager,
} from '../common/events.js';


/**
 * @typedef {import('../common/events.js').EventSubscriber<T>} EventSubscriber<T>
 * @template T
 */
null;

let gOnSettingsChanged = null;

/**
 * Get an `EventSubscriber` for a global `PassthroughEventManager` that subscribes to `browser.storage.onChanged`.
 *
 * @export
 * @returns {EventSubscriber<Object<{oldValue, newValue}>>} A subscriber to a `PassthroughEventManager`.
 */
export function getOnSettingsChanged() {
  if (!gOnSettingsChanged) {
    gOnSettingsChanged = new PassthroughEventManager(browser.storage.onChanged);
  }
  return gOnSettingsChanged.subscriber;
}


/**
 * Keeps a settings object up to date and notifies of any changes.
 * 
 * @class SettingsTracker
 * @template T
 */
export class SettingsTracker {

  /**
   * Creates an instance of SettingsTracker.
   * 
   * @param {Object} Configuration Determines how settings are tracked.
   * @param {null | string} Configuration.storageArea The storage area to track. Defaults to `local`.
   * @param {null | function(T)} Configuration.callback Callback that should be subscribed to the `onChanged` event.
   * @param {boolean} Configuration.fallbackToDefault Determines if default values should be used for deleted keys.
   * @param {null | T | function(): T} Configuration.defaultValues An object with default values for some keys or a function that returns such an object. Ignored if `fallbackToDefault` is `false`.
   * @memberof SettingsTracker
   */
  constructor({ storageArea = null, callback = null, fallbackToDefault = true, defaultValues = null } = {}) {
    if (!storageArea || typeof storageArea !== "string") {
      storageArea = "local";
    }

    if (!defaultValues || (typeof defaultValues !== 'object' && typeof defaultValues !== 'function')) {
      defaultValues = null;
    }

    Object.assign(this, {
      _changedProperties: {},
      _storageArea: storageArea,
      _defaultValues: defaultValues,

      _onChange: new EventManager(),
      _changeListener: null,
    });

    this.fallbackToDefault = fallbackToDefault;

    /** 
     * This object will be modified based on changes notified via events so that it is always up to date with the latest changes.
     * @type {T}
     */
    this.settings = fallbackToDefault && defaultValues ? Object.assign({}, (typeof defaultValues === 'function' ? defaultValues() : defaultValues)) : {};

    this._onChange.addListener(callback);
    this._changeListener = SettingsTracker.createChangeEventListener(this._handleChange.bind(this));

    this.start = this._start();
  }

  _handleChange(changes, areaName) {
    if (areaName !== this._storageArea)
      return;

    const entries = Object.entries(changes);
    if (this._changedProperties) {
      for (const [key,] of entries) {
        this._changedProperties[key] = true;
      }
    }

    let fixedNewValues = null;

    let defaultSettings;
    for (const [key, value] of entries) {
      if ('newValue' in value) {
        this.settings[key] = value.newValue;
      } else {
        if (this.fallbackToDefault && !defaultSettings) {
          defaultSettings = typeof this._defaultValues === 'function' ? this._defaultValues() : this._defaultValues;
        }
        if (this.fallbackToDefault && (key in defaultSettings)) {
          const defaultValue = defaultSettings[key];
          this.settings[key] = defaultValue;

          // Info to fix event data:
          if (!fixedNewValues) fixedNewValues = {};
          fixedNewValues[key] = defaultValue;  // Change event to include new info.
        } else {
          delete this.settings[key];
        }
      }
    }

    // If falling back to defaults values then change the event data to reflect that.
    if (fixedNewValues) {
      changes = Object.assign({}, changes);
      for (const [key, fixedValue] of Object.entries(fixedNewValues)) {
        const oldChange = changes[key];
        if (!oldChange) continue;
        const newChange = Object.assign({}, oldChange);
        newChange.newValue = fixedValue;
        changes[key] = newChange;
      }
    }

    this._onChange.fire(changes, areaName);
  }

  async _start() {
    const allSettings = await SettingsTracker.get(null);
    for (const [key, value] of Object.entries(allSettings)) {
      if (!(key in this._changedProperties)) {
        this.settings[key] = value;
      }
    }
    delete this._changedProperties;
  }

  dispose() {
    this._changeListener.dispose();
  }
  isDisposed() {
    return this._changeListener.isDisposed;
  }
  onDisposed() {
    return this._changeListener.onDisposed;
  }

  /**
   * `EventListener`s will be notified with (changes, areaName). `areaName` will only be the one that the `SettingsTracker` is monitoring.
   * `changes` is an `Object` where each value is a `{newValue, oldValue}`.
   *
   * @readonly
   * @memberof SettingsTracker
   * @returns {EventSubscriber<T>} An event subscriber that is notified when the tracked settings are changed.
   */
  get onChange() {
    return this._onChange.subscriber;
  }


  // #region static functions

  // #region Manage storage

  /**
   * Get values from local storage.
   *
   * @static
   * @param {string | string[] | Object} key The keys to get values for. If an `Object` then get values for all keys and the values in the object correspond to default values.
   * @param {any| Array} [defaultValue=null] The value to use for keys that aren't set. Ignored if key is an `Object`.
   * @returns {any | Object} If one key was provided (not in an array) then the value for that key. Otherwise an object with a key for each provided key.
   * @memberof SettingsTracker
   */
  static async get(key, defaultValue = null) {
    if (typeof key === "string") {
      return (await browser.storage.local.get({ [key]: defaultValue }))[key];
    } else {
      const data = createObjectFromKeys(key, null, defaultValue); // returns key if it isn't an array.
      return await browser.storage.local.get(data);
    }
  }
  /**
   * Set local storage values.
   *
   * @static
   * @param {string | string[] | Object} key The keys to set values for. If an `Object` then set values for all keys.
   * @param {any} [value=null] Value to set for all keys. Ignored if `key` is an `Object`.
   * @memberof SettingsTracker
   */
  static async set(key, value = null) {
    if (typeof key === "string") {
      await browser.storage.local.set({
        [key]: value
      });
    } else {
      const data = createObjectFromKeys(key, null, value); // returns key if it isn't an array.
      await browser.storage.local.set(data);
    }
  }
  /**
   * Remove all keys from local storage.
   *
   * @static
   * @param {string | string[]} key Key(s) to remove values for.
   * @memberof SettingsTracker
   */
  static async remove(key) {
    await browser.storage.local.remove(key);
  }
  /**
   * Clear local storage.
   *
   * @static
   * @memberof SettingsTracker
   */
  static async clear() {
    await browser.storage.local.clear();
  }

  // #endregion Manage storage


  /**
   * Create an event listener for storage changes.
   * 
   * @static
   * @param {any} callback (changes, areaName) Function that will be called when this event occurs. The function will be passed the following arguments:
   * changes:    object. Object describing the change. This contains one property for each key that changed. The name of the property is the name of the key that changed, and its value is a storage.StorageChange object describing the change to that item.
   * areaName:   string. The name of the storage area ("sync", "local" or "managed") to which the changes were made.
   * @returns {EventListener} An event listener for browser.storage.onChanged.
   * @memberof Settings
   */
  static createChangeEventListener(callback) {
    return new EventListener(getOnSettingsChanged(), callback);
  }

  // #endregion static functions
}