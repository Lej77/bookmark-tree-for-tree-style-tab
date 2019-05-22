'use strict';

import {
    defineProperty
} from '../common/utilities.js';

import {
    EventManager
} from '../common/events.js';

import {
    DisposableCollection
} from '../common/disposables.js';


export async function delay(timeInMilliseconds) {
    return new Promise((resolve, reject) => {
        try {
            timeInMilliseconds < 0 ? resolve() : setTimeout(resolve, timeInMilliseconds);
        } catch (error) {
            reject(error);
        }
    });
}

/**
 * A delay that will be canceled if a disposable collection is disposed.
 * 
 * @param {number} timeInMilliseconds Time in milliseconds to wait.
 * @param {DisposableCollection} [disposables=null] Disposables collection to bind delay to.
 * @returns {Promise<boolean>} True if successful. False if canceled.
 */
export async function boundDelay(timeInMilliseconds, disposables = null) {
    if (!disposables) {
        await delay(timeInMilliseconds);
        return true;
    }
    return new Promise((resolve, reject) => {
        try {
            let timeout = new Timeout(() => resolve(true), timeInMilliseconds);
            timeout.onDisposed.addListener(() => resolve(false));
            if (disposables) {
                disposables.trackDisposables(timeout);
            }
        } catch (error) {
            reject(error);
        }
    });
}


/**
 * Get the first "true" value returned from an array of promises.
 *
 * @export
 * @param {Array} array Promises to await for values.
 * @returns {*|false} Value of the promise that first resolved to a true value. Otherwise false.
 */
export function checkAny(array) {
    array = array.filter(value => value);
    if (array.length === 0) {
        return false;
    }

    let promiseWrapper = new PromiseWrapper();

    let promises = 0;
    let waitForValue = async (value) => {
        try {
            value = await value;
            if (value) {
                promiseWrapper.resolve(value);
            }
        } finally {
            promises--;

            if (promises <= 0) {
                promiseWrapper.resolve(false);
            }
        }
    };

    promises++;
    for (let value of array) {
        promises++;
        waitForValue(value);
    }
    promises--;

    if (promises <= 0) {
        promiseWrapper.resolve(false);
    }
    return promiseWrapper.getValue();
}

/**
 * Allows synchronous access to a Promise's resolve and reject functions.
 * 
 * @class PromiseWrapper
 */
export class PromiseWrapper {

    /**
     * Creates an instance of PromiseWrapper.
     * @param {boolean} [createPromise=true] Determines if a promise should be created immediately.
     * @memberof PromiseWrapper
     */
    constructor(createPromise = true) {
        Object.assign(this, {
            _resolve: null,
            _reject: null,
            _value: null,
            _isError: false,
            _set: false,
            _promise: null,
        });

        if (createPromise) {
            this.createPromise();
        }
    }


    resolve(value) {
        this.setValue(value, false);
    }

    reject(error) {
        this.setValue(error, true);
    }

    setValue(value, isError = false) {
        if (this._set) {
            return;
        }
        this._set = true;
        this._isError = isError;
        this._value = value;

        if (isError) {
            if (this._reject) {
                this._reject(value);
            }
        } else {
            if (this._resolve) {
                this._resolve(value);
            }
        }
    }

    createPromise() {
        if (this.isPromiseCreated) {
            return;
        }
        this._promise = new Promise((resolve, reject) => {
            if (this._set) {
                if (this._isError) {
                    reject(this._value);
                } else {
                    resolve(this._value);
                }
            }
            this._resolve = resolve;
            this._reject = reject;
        });
    }

    /**
     * Returns a promise if it is available or if it is the only way to provide the results.
     * 
     * @returns {any} Either a promise that will be resolved to the correct value or the value that the promise would have been resolved to.
     * @memberof PromiseWrapper
     */
    getValue() {
        if (this.isPromiseCreated || !this.done || this.isError) {
            return this.promise;
        }
        return this.value;
    }

    get promise() {
        this.createPromise();
        return this._promise;
    }

    get isPromiseCreated() {
        return Boolean(this._promise);
    }

    /**
     * Indicates if the promise has a value, that is to say has been resolved or rejected.
     * 
     * @readonly
     * @memberof PromiseWrapper
     */
    get done() {
        return Boolean(this._set);
    }

    /**
     * Indicates if the promise was rejected.
     * 
     * @readonly
     * @memberof PromiseWrapper
     */
    get isError() {
        return Boolean(this._isError);
    }

    /**
     * The value that the promise was resolved or rejected with.
     * 
     * @readonly
     * @memberof PromiseWrapper
     */
    get value() {
        return this._value;
    }

}


/**
 * Tracks disposables and disposes of them when a promise is resolved.
 * 
 * @class OperationManager
 */
export class OperationManager {
    constructor() {
        var promiseWrapper = new PromiseWrapper(false);
        let disposableCollection = new DisposableCollection();

        let setValue = (value, isError = false) => {
            if (isError) {
                promiseWrapper.reject(value);
            } else {
                promiseWrapper.resolve(value);
            }
            disposableCollection.dispose();
        };

        this.trackDisposables = (disposables) => disposableCollection.trackDisposables(disposables);

        defineProperty(this, 'done', () => promiseWrapper.done);

        defineProperty(this, 'value',
            () => promiseWrapper.getValue(),
            (value) => setValue(value)
        );

        this.resolve = (value) => setValue(value);
        this.reject = (value) => setValue(value, true);
    }
}


/**
 * Wrap a setTimeout call and keep track of the timeoutId.
 * 
 * @class Timeout
 */
export class Timeout {

    constructor(callback, timeInMilliseconds) {
        Object.assign(this, {
            _isDisposed: false,
            _onDisposed: null,

            _timeoutId: null,
            _callback: callback,

            _timeInMilliseconds: timeInMilliseconds,
        });
        this._start();
    }

    _start() {
        if (this._callback && typeof this._callback === 'function') {
            this._timeoutId = setTimeout(() => {
                this._timeoutId = null;
                try {
                    this._callback();
                } finally {
                    this.dispose();
                }
            }, this._timeInMilliseconds);
        } else {
            this.dispose();
        }
    }


    // #region Dispose

    dispose() {
        if (this.isDisposed) {
            return;
        }
        this._isDisposed = true;
        if (this._timeoutId !== null) {
            clearTimeout(this._timeoutId);
            this._timeoutId = null;
        }
        if (this._onDisposed)
            this._onDisposed.fire(this);
    }
    get isDisposed() {
        return this._isDisposed;
    }
    get onDisposed() {
        if (!this._onDisposed)
            this._onDisposed = new EventManager();
        return this._onDisposed.subscriber;
    }

    get isActive() {
        return Boolean(this._timeoutId !== null);
    }

    // #endregion Dispose

    get promise() {
        return new Promise((resolve, reject) => {
            try {
                if (this.isDisposed) {
                    resolve();
                } else {
                    this.onDisposed.addListener(resolve);
                }
            } catch (error) {
                reject(error);
            }
        });
    }

    get timeInMilliseconds() {
        return this._timeInMilliseconds;
    }

    get callback() {
        return this._callback;
    }
}


/**
 * Ensure a callback isn't called too often.
 * 
 * @class RequestManager
 */
export class RequestManager {

    constructor(callback = null, blockTimeInMilliseconds = 1000, simultaneousUpdates = false) {
        Object.assign(this, {
            _isDisposed: false,
            _onDisposed: new EventManager(),

            _onUpdate: new EventManager(),

            _blockTimeout: null,
            _invalidated: false,
            _lastArgs: [],
            _confirmPromiseWrapper: new PromiseWrapper(),

            _simultaneousUpdates: simultaneousUpdates,
            _updates: 0,

            blockTimeInMilliseconds: blockTimeInMilliseconds,
        });

        this._onUpdate.addListener(callback);
    }

    /**
     * Block all updates.
     * 
     * @param {any} [overrideTime=null] The time to block the updates in milliseconds. If false the default time will be used.
     * @returns {Timeout} A Timeout object that will be closed when the block has expired.
     * @memberof RequestManager
     */
    block(overrideTime = null) {
        if (this._blockTimeout) {
            this._blockTimeout.dispose();
        }
        if (this.isDisposed) {
            return;
        }
        let time;
        if (overrideTime || overrideTime === 0) {
            time = overrideTime;
        } else if (typeof this.blockTimeInMilliseconds === 'function') {
            time = this.blockTimeInMilliseconds();
        } else {
            time = this.blockTimeInMilliseconds;
        }
        this._blockTimeout = new Timeout(() => this.unblock(), time);
        return this._blockTimeout;
    }

    /**
     * Unblock and update if invalidated.
     * 
     * @memberof RequestManager
     */
    unblock() {
        if (this._blockTimeout) {
            this._blockTimeout.dispose();
        }
        if (this.isInvalidated) {
            this._update();
        }
    }

    /**
     * Unblock and update. Forces an update now and block after it.
     * 
     * @memberof RequestManager
     */
    async forceUpdate() {
        this._lastArgs = Array.from(arguments);
        await this._update(true);
    }

    async _update(external = false) {
        if (this.isDisposed) {
            return;
        }
        if (!this._simultaneousUpdates && this.updateInProgress) {
            // Unblocked but last update has yet to complete.
            this._invalidated = true;
            if (external) {
                await this._confirmPromiseWrapper.getValue();
            }
            return;
        }

        let b = this.block();
        this._invalidated = false;

        let args = this._lastArgs;
        this._lastArgs = [];

        let affectedConfirmPromise = this._confirmPromiseWrapper;
        this._confirmPromiseWrapper = new PromiseWrapper();
        this._confirmPromiseWrapper.promise.then((value) => affectedConfirmPromise.resolve(value));

        let releaseBlock = false;
        try {
            this._updates++;
            releaseBlock = await checkAny(this._onUpdate.fire.apply(this._onUpdate, args));

            if (releaseBlock && b === this._blockTimeout) {
                this.unblock();
            }
        } finally {
            this._updates--;
            affectedConfirmPromise.resolve(true);
            if (!this.isBlocked && this.isInvalidated) {
                if (this._simultaneousUpdates || !this.updateInProgress) {
                    this._update();
                }
            }
        }
    }

    /**
     * Update after block is released.
     * 
     * @returns {boolean} True if update was successful.
     * @memberof RequestManager
     */
    async invalidate() {
        if (this.isDisposed) {
            return false;
        }
        this._invalidated = true;
        this._lastArgs = Array.from(arguments);
        let updatePromise = this._confirmPromiseWrapper.getValue();
        if (!this.isBlocked) {
            this._update();
        }
        return updatePromise;
    }


    get isBlocked() {
        return this._blockTimeout && this._blockTimeout.isActive;
    }

    get updateInProgress() {
        return this._updates > 0;
    }

    get lastArgs() {
        return this._lastArgs;
    }

    get isInvalidated() {
        return this._invalidated;
    }

    get onUpdate() {
        return this._onUpdate.subscriber;
    }


    // #region Dispose

    /**
     * Unblock and prevent further updates.
     * 
     * @memberof RequestManager
     */
    dispose() {
        if (this.isDisposed) {
            return;
        }
        this._isDisposed = true;

        this._confirmPromiseWrapper.resolve(false);
        this.unblock();

        this._onDisposed.fire(this);
    }

    get isDisposed() {
        return this._isDisposed;
    }
    get onDisposed() {
        return this._onDisposed.subscriber;
    }

    // #endregion Dispose

}


/**
 * Delay events and handle them later.
 * 
 * @class EventQueue
 */
export class EventQueue {
    constructor() {
        Object.assign(this, {
            _isDisposed: false,

            queuedEvents: [],
            unsafeToContinue: false,
        });
    }

    /**
     * Handle an event. The callback might be delayed.
     * 
     * @param {Function} callback Function to call when the event should be handled. First arg is a Boolean that is true if the callback was delayed.
     * @param {boolean} [safeToDelay=false] Indicates if it is safe to delay the event handler.
     * @memberof EventQueue
     */
    handleEvent(callback, safeToDelay = false) {
        if (this.queuedEvents) {
            this.queuedEvents.push(callback);
            if (!safeToDelay) {
                this.unsafeToContinue = true;
            }
        } else if (!this.isDisposed) {
            callback(false);
        }
    }
    handleQueuedEvents(dontDelayFutureEvents = false) {
        while (!this.isDisposed && this.queuedEvents && this.queuedEvents.length > 0) {
            this.queuedEvents[0](true);
            this.queuedEvents.splice(0, 1);
        }
        if (dontDelayFutureEvents) {
            this.isDelayingEvents = false;
        }
    }
    resetEventQueue() {
        if (this.queuedEvents) {
            this.queuedEvents = [];
        }
        this.unsafeToContinue = false;
    }

    dispose() {
        if (this.isDisposed) {
            return;
        }
        this._isDisposed = true;
        this.queuedEvents = [];
        this.unsafeToContinue = false;
    }

    get isDelayingEvents() {
        return Boolean(this.queuedEvents);
    }
    set isDelayingEvents(value) {
        value = Boolean(value);
        if (this.isDelayingEvents === value) {
            return;
        }

        this.queuedEvents = value ? [] : null;
        this.unsafeToContinue = false;
    }

    get isDisposed() {
        return this._isDisposed;
    }
}
