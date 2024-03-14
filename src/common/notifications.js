'use strict';

import {
    getPromiseWithResolve,
} from '../common/utilities.js';

import {
    EventListener,
    PassthroughEventManager,
    EventManager,
} from '../common/events.js';


/**
 * @typedef {import('../common/events.js').EventSubscriber<T>} EventSubscriber<T>
 * @template T
 */
null;


/**
 * @typedef {string} NotificationId A string representing a notification's ID.
 */
null;

/**
 * @typedef {Object} BasicNotificationOptions Configuration for the shown notification.
 * @property {string | null} [Options.id] Id of the notification. If not present or an empty string is provided then a unique id will be generated, otherwise this id will be used. If the ID you provide matches the ID of an existing notification from this extension, then the other notification will be cleared.
 * @property {string} Options.title Title of the shown notification.
 * @property {string} Options.message The text content of the shown notification. If this is too long then not all of it will be shown.
 * @property {string | null} [Options.iconUrl] A URL to an icon that should be shown in the notification.
 */
null;


let gOnClicked = null;
let gOnClosed = null;
let gOnShown = null;

/**
 * Get an `EventSubscriber` for the `browser.notifications.onClicked` event.
 *
 * @returns {EventSubscriber<[NotificationId]>} A subscriber for the event.
 */
export function getOnNotificationClicked() {
    if (!gOnClicked) {
        gOnClicked = new PassthroughEventManager(browser.notifications.onClicked);
    }
    return gOnClicked.subscriber;
}
/**
 * Get an `EventSubscriber` for the `browser.notifications.onClosed` event.
 *
 * @returns {EventSubscriber<[NotificationId]>} A subscriber for the event.
 */
export function getOnNotificationClosed() {
    if (!gOnClosed) {
        gOnClosed = new PassthroughEventManager(browser.notifications.onClosed);
    }
    return gOnClosed.subscriber;
}
/**
 * Get an `EventSubscriber` for the `browser.notifications.onShown` event.
 *
 * @returns {EventSubscriber<[NotificationId]>} A subscriber for the event.
 */
export function getOnNotificationShown() {
    if (!gOnShown) {
        gOnShown = new PassthroughEventManager(browser.notifications.onShown);
    }
    return gOnShown.subscriber;
}

/**
 * Close an open notification.
 *
 * @export
 * @param {NotificationId} id The ID of the notification to close.
 * @returns {Promise<boolean>} `true` if the notification was cleared, or `false` if it was not (for example, because the notification referenced by id did not exist).
 */
export async function closeNotification(id) {
    return browser.notifications.clear(id);
}

/**
 * Show a "basic" notification to the user.
 *
 * @export
 * @param {BasicNotificationOptions} options Configuration for the shown notification.
 * @returns {Promise<NotificationId>} The notifications id.
 */
export async function showBasicNotification({ id = null, title, message, iconUrl = null }) {
    const notificationOptions = {
        type: 'basic',
        title,
        message,
    };
    if (iconUrl) {
        notificationOptions.iconUrl = iconUrl;
    }
    if (id && typeof id === 'string') {
        return browser.notifications.create(id, notificationOptions);
    } else {
        return browser.notifications.create(notificationOptions);
    }
}

/**
 * Show a notification to the user and return `true` if it was clicked and `false` if it was closed.
 *
 * @export
 * @param {BasicNotificationOptions} options Configuration for the shown notification.
 * @returns {Promise<boolean>} `true` if the notification was clicked and `false` if it was closed.
 */
export async function confirmWithNotification({ id = null, title, message, iconUrl = null }) {
    const wantedNotificationId = id;
    let promiseInfo;
    let onClick;
    let onClose;
    try {
        promiseInfo = await getPromiseWithResolve();

        let id = null;
        onClick = new EventListener(getOnNotificationClicked(), (notificationId) => {
            if (id !== null && notificationId === id) {
                promiseInfo.resolve(true);
            }
        });
        onClose = new EventListener(getOnNotificationClosed(), (notificationId) => {
            if (id !== null && notificationId === id) {
                promiseInfo.resolve(false);
            }
        });

        id = await showBasicNotification({ id: wantedNotificationId, title, message, iconUrl });

        return await promiseInfo.promise;
    } finally {
        if (promiseInfo)
            promiseInfo.resolve(false);

        if (onClick)
            onClick.dispose();
        if (onClose)
            onClose.dispose();
    }
}

/**
 * @typedef {BasicNotificationOptions & ExtraNotificationConstructorOptions} NotificationConstructorArgs Configuration for a notification that should be tracked.
 *
 * @typedef ExtraNotificationConstructorOptions
 * @property {boolean} [Config.trackShown] `true` to track when the notification is shown.
 */
null;

/**
 * Keeps track of a notification.
 *
 * @export
 * @class Notification
 */
export class Notification {

    /**
     * Show a "basic" notification to the user.
     *
     * @export
     * @param {NotificationConstructorArgs} Options Configuration for the shown notification.
     */
    constructor({ id = null, title, message, iconUrl = null, trackShown = true }) {
        if (!id || typeof id !== 'string') id = null;
        this._id = id;
        this._options = { id, title, message, iconUrl };

        if (!trackShown) trackShown = null;
        this._isShown = trackShown ? false : null;
        this._shownPromiseHandler = trackShown && getPromiseWithResolve();
        this._shown = this._shownPromiseHandler && this._shownPromiseHandler.then(handler => handler.promise).then(shown => {
            if (shown === null) return null; // Disposed!
            this._isShown = true;
            return shown;
        });

        this._isClosed = false;
        this._wasClicked = false;
        this._closedPromiseHandler = getPromiseWithResolve();
        this._closed = this._closedPromiseHandler.then(handler => handler.promise).then(clicked => {
            if (clicked === null) return null; // Disposed!
            this._isClosed = true;
            this._wasClicked = clicked;
            return clicked;
        });

        this._isDisposed = false;
        this._onDisposed = new EventManager();

        this._finished = this._start();
        this._finished.catch(error => console.error('Failed to monitor a notification.\nNotification Create Options:\n', this._options, '\nError:\n', error));
    }

    async _onShown(notificationId) {
        const id = await this.waitUntilCreated();
        if (id !== null && notificationId === id) {
            (await this._shownPromiseHandler).resolve(true);
        }
    }
    async _onClicked(notificationId) {
        const id = await this.waitUntilCreated();
        if (id !== null && notificationId === id) {
            (await this._closedPromiseHandler).resolve(true);
        }
    }
    async _onClosed(notificationId) {
        const id = await this.waitUntilCreated();
        if (id !== null && notificationId === id) {
            (await this._closedPromiseHandler).resolve(false);
        }
    }

    async _start() {
        try {
            this._onShownListener = this._shownPromiseHandler && new EventListener(getOnNotificationShown(), this._onShown.bind(this));
            this._onClickListener = new EventListener(getOnNotificationClicked(), this._onClicked.bind(this));
            this._onClosedListener = new EventListener(getOnNotificationClosed(), this._onClosed.bind(this));

            this._created = this._create();
            await this._created; // Might throw error in which case dispose all.
            await this._closed;
        } finally {
            this.dispose();
        }
    }

    async _create() {
        this._id = await showBasicNotification(this._options);
        return this._id;
    }

    dispose() {
        if (this._isDisposed) return;

        if (this._onShownListener) this._onShownListener.dispose();
        if (this._onClickListener) this._onClickListener.dispose();
        if (this._onClosedListener) this._onClosedListener.dispose();

        if (this._shownPromiseHandler) this._shownPromiseHandler.then(handler => handler.resolve(null));
        if (this._closedPromiseHandler) this._closedPromiseHandler.then(handler => handler.resolve(null));

        this._isDisposed = true;
        this._onDisposed.fire();
    }
    get onDisposed() {
        return this._onDisposed.subscriber;
    }

    /**
     * Close this notification. If the class is disposed then another notification with the same id might be closed instead.
     *
     * @returns {Promise<boolean>} `true` if the notification needed to be closed and was successfully closed; otherwise `false`.
     * @memberof Notification
     */
    async closeNotification() {
        if (this.isClosed) return false;
        return closeNotification(await this.getId());
    }

    /**
     * Wait until the notification id is known and then return it.
     *
     * @returns {Promise<NotificationId>} The id of the shown notification.
     * @memberof Notification
     */
    async getId() {
        if (this.id !== null) return this.id;
        return this._created;
    }

    /**
     * Wait until the notification has been closed.
     *
     * @returns {Promise<boolean | null>} `true` if the notification was clicked. `false` if the notification wasn't clicked. `null` if the listener was disposed.
     * @memberof Notification
     */
    async waitUntilClosed() {
        return this._closed;
    }

    /**
     * Wait until the notification is shown.
     *
     * @returns {Promise<boolean | null>} `true` if the notification was shown. `null` if the listener was disposed or never created.
     * @memberof Notification
     */
    async waitUntilShown() {
        return this._shown;
    }

    /**
     * Wait until the notification's creation has been processed.
     *
     * @returns {Promise<NotificationId>} The notification's id.
     * @memberof Notification
     */
    async waitUntilCreated() {
        return this._created;
    }

    /**
     * Get the id if it is already known, otherwise return `null`.
     *
     * @readonly
     * @memberof Notification
     */
    get id() {
        return this._id;
    }

    /**
     * `true` if the notification was shown, `false` if it wasn't. Will be `null` if not tracking when the notification was shown.
     *
     * @readonly
     * @memberof Notification
     */
    get isShown() {
        return this._isShown;
    }
    get isClosed() {
        return this._isClosed;
    }
    get wasClicked() {
        return this._wasClicked;
    }
}