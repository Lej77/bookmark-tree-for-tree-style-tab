'use strict';

import {
  defineProperty
} from '../common/utilities.js';


export function accessDataObjectWithProperties(accessObject, dataObject) {
  let onChangeManager = new EventManager();
  let propKeys = Object.keys(dataObject);

  for (let key of propKeys) {
    defineProperty(accessObject, key,
      function () {
        return dataObject[key];
      },
      function (value) {
        if (dataObject[key] === value) {
          return;
        }
        let old = dataObject[key];
        dataObject[key] = value;
        onChangeManager.fire(key, old, value);
      }
    );
  }
  return onChangeManager.subscriber;
}

/**
 * Listens to an event.
 * 
 * @class EventListener
 * @template T
 */
export class EventListener {

  /**
   * Creates an instance of EventListener.
   * @param {Object} DOMElementOrEventObject If DOM event: the DOM object to listen on. Otherwise: the event object to add a listener to.
   * @param {string | function(T,)} eventNameOrCallback If DOM event: the name of the event. Otherwise: callback.
   * @param {null | function(T,) | Object} callbackOrExtraParameters If DOM event: callback. Otherwise: optional extra parameter for the add listener function.
   * @memberof EventListener
   */
  constructor(DOMElementOrEventObject, eventNameOrCallback, callbackOrExtraParameters = null) {
    Object.assign(this, {
      _onDisposed: null,
    });

    if (typeof eventNameOrCallback === 'string' && typeof callbackOrExtraParameters === 'function') {
      this._DOMElement = DOMElementOrEventObject;
      this._event = eventNameOrCallback;
      this._callback = callbackOrExtraParameters;
    } else {
      this._event = DOMElementOrEventObject;
      this._callback = eventNameOrCallback;
      this._extraParameter = callbackOrExtraParameters;
    }

    if (this._DOMElement) {
      this._DOMElement.addEventListener(this._event, this._callback);
    } else {
      if (this._extraParameter) {
        this._event.addListener(this._callback, this._extraParameter);
      } else {
        this._event.addListener(this._callback);
      }
    }
  }

  dispose() {
    if (this._callback) {
      if (this._DOMElement) {
        this._DOMElement.removeEventListener(this._event, this._callback);
      } else {
        this._event.removeListener(this._callback);
      }
      this._callback = null;
      if (this._onDisposed) {
        this._onDisposed.fire(this);
      }
    }
  }

  get isDisposed() {
    return !Boolean(this._callback);
  }
  get isActive() {
    if (this._DOMElement) {
      return !this.isDisposed;
    } else {
      return this._event.hasListener(this._callback);
    }
  }

  get onDisposed() {
    if (!this._onDisposed) {
      this._onDisposed = new EventManager();
    }
    return this._onDisposed.subscriber;
  }
}


/**
 * Keeps track of listeners for an event.
 * 
 * @class EventSubscriber
 * @template T
 */
export class EventSubscriber {
  constructor(changeCallback = null) {
    Object.assign(this, {
      _listeners: new Set(),
      _changeCallback: changeCallback && typeof changeCallback === 'function' ? changeCallback : null,
      _extraParameters: new WeakMap(),
    });
  }

  /**
   * Add listener to the event.
   *
   * @param {function(T,)} listener A function that will be called when the event is triggered.
   * @param {Object | undefined} extraParameters If this value isn't undefined then it can be used by the event to filter when the callback is called.
   * @memberof EventSubscriber
   */
  addListener(listener, extraParameters = undefined) {
    if (!listener || typeof listener !== 'function' || this.hasListener(listener))
      return;

    if (extraParameters !== undefined)
      this._extraParameters.set(listener, extraParameters);

    this._listeners.add(listener);
    if (this._changeCallback)
      this._changeCallback(this, listener, true);
  }
  /**
   * Remove a listener from the event.
   *
   * @param {function(T,)} listener A function that was previously added to the event.
   * @memberof EventSubscriber
   */
  removeListener(listener) {
    if (!listener || !this.hasListener(listener))
      return;

    this._listeners.delete(listener);
    this._extraParameters.delete(listener);

    if (this._changeCallback)
      this._changeCallback(this, listener, false);
  }
  /**
   * Check if a function is subscribed to the event.
   *
   * @param {function(T,)} listener A function that might have been subscribed to the event.
   * @returns {boolean} True if the event is subscribed to the event; otherwise false.
   * @memberof EventSubscriber
   */
  hasListener(listener) {
    return this._listeners.has(listener);
  }
}


/**
 * Advanced features for an event subscriber such as calling all listeners.
 * 
 * @class EventManager
 * @extends {EventSubscriber<T>}
 * @template T
 */
export class EventManager extends EventSubscriber {
  constructor() {
    super();
    Object.assign(this, {
      _changeCallback: this._handleChange.bind(this),
      _subscriber: null,
      _onChange: null,
      _stackTrackWhenAdded: new WeakMap(),
    });
  }

  _handleChange(obj, listener, added) {
    if (added)
      this._stackTrackWhenAdded.set(listener, new Error().stack);
    else
      this._stackTrackWhenAdded.delete(listener);

    if (this._onChange)
      this._onChange.fire(this, listener, added);
  }



  _filterListeners(callback, any = false) {
    let checkListener = (listener) => callback(this._extraParameters.get(listener));
    if (!callback || typeof callback !== 'function')
      checkListener = () => true;

    if (any)
      return this._listeners.some(checkListener);
    else
      return this._listeners.filter(checkListener);
  }


  /**
   * Check if any listeners' extra parameter fulfills a test.
   *
   * @param {*} filterCallback Called to check a listener's extra parameter.
   * @returns {boolean} True if any listeners extra parameter fulfilled the callback.
   * @memberof EventManager
   */
  checkFilter(filterCallback) {
    return this._filterListeners(filterCallback, true);
  }


  filterAndFire(filterCallback, ...args) {
    return this._fire(this._filterListeners(filterCallback, false), args);
  }

  dispatch(...args) {
    return this.fire(...args);
  }

  /**
   * Notify all event listeners.
   *
   * @param {[T,]} args Arguments to call the event listeners with.
   * @returns {Array} An array with the values returned from the listeners.
   * @memberof EventManager
   */
  fire(...args) {
    return this._fire(this._listeners.values(), args);
  }

  _fire(listeners, args) {
    const returned = [];
    for (let listener of listeners) {
      try {
        returned.push(listener.apply(null, args));
      } catch (error) {
        const stack = this._stackTrackWhenAdded.get(listener);
        console.log('Error during event handling!\n', error, '\nListener added at:\n', stack, '\nError at:\n', error.stack);
      }
    }
    return returned;
  }


  clear() {
    this._listeners.clear();
    this._stackTrackWhenAdded.clear();
    this._extraParameters.clear();
    if (this._onChange) {
      this._onChange.fire(this);
    }
  }


  /**
   * The listeners that are subscribed to this event.
   *
   * @param {function(T,)[]} value Change the subscribed listeners to this array.
   * @memberof EventManager
   * @returns {function(T,)[]} An array of event listeners subscribed to this event.
   */
  get listeners() {
    return Array.from(this._listeners.values());
  }
  set listeners(value) {
    this._listeners = value;
    if (this._onChange)
      this._onChange.fire(this);
  }

  get listenersLength() {
    return this._listeners.size;
  }

  /**
   * An event that is triggered when the event listeners are changed. Args: manager, listener [optional], added [optional]
   * 
   * @readonly
   * @memberof EventManager
   */
  get onChanged() {
    if (!this._onChange)
      this._onChange = new EventManager();
    return this._onChange;
  }

  /**
   * 
   * 
   * @returns {EventSubscriber<T>} A event subscriber that is connected to this manager.
   * @readonly
   * @memberof EventManager
   */
  get subscriber() {
    if (!this._subscriber) {
      this._subscriber = new EventSubscriber(this._changeCallback);
      defineProperty(this._subscriber, '_listeners', () => this._listeners, (value) => { this._listeners = value; });
    }
    return this._subscriber;
  }
}

/**
 * An `EventManager` that is triggered by an `EventSubscriber`. The argument from the `EventSubscriber` can be modified 
 * before it is passed to any `EventSubscriber` of this `EventManager`.
 *
 * @export
 * @class PassthroughEventManager
 * @extends {EventManager<T>}
 * @template T
 */
export class PassthroughEventManager extends EventManager {

  /**
   * Create an event that passes on data from another event.
   * 
   * @static
   * @param {EventSubscriber | EventSubscriber[]} originalEvent The original event or an array of events that will all be listened to.
   * @param {function} returnModifier Allows modifying the returned values. The first argument is an array with the values the listeners returned. The array returned by this function will be used instead. If a false value is returned it will be used as return value.
   * @param {function([T,])} argumentModifier Modify the arguments passed to the listeners. The first arg is an array of the args that will be used. The array returned by this function will be used instead. If a false value is returned then the listeners will not be called.
   * @memberof EventManager
   */
  constructor(originalEvent, returnModifier = null, argumentModifier = null) {
    super();
    const checkIfFunction = (test) => test && typeof test === 'function';
    Object.assign(this, {
      _passOriginalEvents: Array.isArray(originalEvent) ? originalEvent : [originalEvent],
      _passOriginalEventListeners: null,

      _passReturnModifier: returnModifier,
      _passHasReturnModifier: checkIfFunction(returnModifier),

      _passArgumentModifier: argumentModifier,
      _passHasArgumentModifier: checkIfFunction(argumentModifier),

      _changeListener: new EventListener(this.onChanged, this._passOnChanged.bind(this)),
    });
  }

  _passOnChanged() {
    if (this.listenersLength === 0) {
      this._passStop();
    } else {
      this._passStart();
    }
  }

  /**
   * Trigger the event but modify the arguments and the returned values.
   *
   * @param {[T,]} args Arguments to modify and then use to call listeners.
   * @returns {Array} Modified return values from listeners.
   * @memberof PassthroughEventManager
   */
  fireWithModifiers(...args) {
    if (this.isDisposed) return [];

    // Modify event arguments:
    if (this._passHasArgumentModifier) {
      args = this._passArgumentModifier(args);
      if (!args || !Array.isArray(args)) {
        return [];
      }
    }

    const returned = this.fire(...args);

    // Modify event return values:
    if (this._passHasReturnModifier) {
      const fixedReturned = this._passReturnModifier(returned);
      if (fixedReturned && Array.isArray(fixedReturned)) {
        return fixedReturned;
      }
    }

    return returned;
  }

  _passHandleEvent(...args) {
    const returned = this.fireWithModifiers(...args);

    if (returned.length === 1)
      return returned[0];

    let firstNotUndefined = undefined;
    for (const value of returned) {
      if (value) {
        // First true value gets priority.
        return value;
      }
      if (firstNotUndefined === undefined && value !== undefined) {
        firstNotUndefined = value;
      }
    }
    // If no true value then first value that wasn't undefined.
    return firstNotUndefined;
  }

  _passStart() {
    if (!this._passOriginalEventListeners) {
      this._passOriginalEventListeners = this._passOriginalEvents.map(event => new EventListener(event, this._passHandleEvent.bind(this)));
    }
  }
  _passStop() {
    if (this._passOriginalEventListeners) {
      for (const listener of this._passOriginalEventListeners) {
        listener.dispose();
      }
      this._passOriginalEventListeners = null;
    }
  }

  dispose() {
    this._changeListener.dispose();
    this._passStop();
  }
  get isDisposed() {
    return this._changeListener.isDisposed;
  }
  get onDisposed() {
    return this._changeListener.onDisposed;
  }
}
