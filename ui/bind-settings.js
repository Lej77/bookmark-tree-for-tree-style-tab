'use strict';

import {
    EventListener
} from '../common/events.js';


/**
 * @typedef {import('../common/events.js').EventSubscriber<T>} EventSubscriber<T>
 * @template T
 */
null;

/**
 * An event object for an input value update of a settings bound element.
 * 
 * @typedef {Object} BoundElementEvent
 * @property {string} Event.key The settings key that the element is bound to.
 * @property {HTMLElement} Event.element The HTML element that is bound to the setting.
 * @property {any} Event.value The value of the bound HTML element.
 * @property {function(any)} Event.setValue A callback function that can change the value of the bound HTML element.
 */
null;

/**
 * Info about some elements that are bound to settings.
 * 
 * @typedef {Object} BoundElementsInfo
 * @property {EventListener[]} Info.listeners Empty array if no `handleInputEvent` and no `onSettingsChanged` was provided. Otherwise event listeners for the subscribed events.
 * @property {boolean} Info.isDisposed Indicates that all event listeners and timeouts has been disposed and canceled.
 * @property {function()} Info.dispose Stop syncing settings with DOM elements.
 * @property {function()} Info.skipCurrentInputIgnore Skip any delays to settings sync that is caused by previous input events.
 */
null;

/**
 * Set the value of elements with ids to some provided values.
 * 
 * If `handleInputEvent` is provided then it will be notified with an object like {key, element, value, setValue: function(newValue)}
 * when any of the elements' values are changed.
 *
 * @export
 * @template T
 * @param {T} settings An object with keys that correspond to element ids and values that should be used for those elements.
 * @param {Object} details Configure how changes are handled.
 * @param {null | function(BoundElementEvent)} details.handleInputEvent A function to listen for changes in the elements' values.
 * @param {EventSubscriber<T | Object<{newValue, oldValue}>>} details.onSettingsChanged Event that is notified with changes to the settings object. Keys are element ids and Values are the elements new value.
 * @param {boolean} details.newValuePattern If `true` then `onSettingsChanged` should be notified with an object where each value is an object with the keys `{newValue, oldValue}`.
 * @param {number} details.timeToIgnoreSettingAfterInputInMilliseconds If both `onSettingsChanged` and `handleInputEvent` is provided then `onSettingsChanged` changes will be ignore until there hasn't been input changes for at least this long for the affected element.
 * @returns {BoundElementsInfo} Info about the bound elements and event listeners that are in use.
 */
export function bindElementIdsToSettings(settings, {
    handleInputEvent = null,
    onSettingsChanged = null,
    newValuePattern = true,
    timeToIgnoreSettingAfterInputInMilliseconds = 500,
}) {
    if (!handleInputEvent || typeof handleInputEvent !== 'function') {
        handleInputEvent = null;
    }
    if (!timeToIgnoreSettingAfterInputInMilliseconds || typeof timeToIgnoreSettingAfterInputInMilliseconds !== 'number') {
        timeToIgnoreSettingAfterInputInMilliseconds = 0;
    }

    const controlTimeouts = [];
    let isDisposed = false;

    const setElementValue = onSettingsChanged ? {} : null;
    const listeners = [];
    for (const key of Object.keys(settings)) {

        // Try to find element:

        const element = document.getElementById(key);
        if (!element)
            continue;

        // Set value to element:

        let propertyName;
        if (element.type === 'checkbox')
            propertyName = 'checked';
        else
            propertyName = 'value';

        const setValue = (value) => {
            element[propertyName] = value;
        };
        setValue(settings[key]);

        // Handle setting changes:

        let lastInputTime = setElementValue && timeToIgnoreSettingAfterInputInMilliseconds > 0 ? 0 : null;
        let timeoutId = null;
        if (setElementValue) {
            let lastValue = null;
            const requestChange = () => {
                if (timeoutId !== null) return; // Change is delayed.
                if (lastInputTime !== null) {      // Should delay changes.
                    const currentTime = Date.now();
                    if (lastInputTime > currentTime) lastInputTime = currentTime; // Last change was in the future. (Maybe clock was changed?)
                    else {
                        const timeSinceLastChange = currentTime - lastInputTime;
                        if (timeSinceLastChange < timeToIgnoreSettingAfterInputInMilliseconds) {  // Element value should not be changed.
                            const timeLeft = timeToIgnoreSettingAfterInputInMilliseconds - timeSinceLastChange;
                            timeoutId = setTimeout(() => {
                                timeoutId = null;
                                requestChange();
                            }, timeLeft + 1);
                            return;
                        }
                    }
                }
                setValue(lastValue);
            };
            setElementValue[key] = (newValue) => {
                lastValue = newValue;
                requestChange();
            };
            if (lastInputTime !== null) {
                controlTimeouts.push((forceUpdate = false) => {
                    if (lastInputTime !== null)
                        lastInputTime = forceUpdate ? 0 : null;

                    if (timeoutId !== null) {
                        clearTimeout(timeoutId);
                        timeoutId = null;

                        if (forceUpdate)
                            requestChange();
                    }
                });
            }
        }

        // Handle input events:

        if (handleInputEvent) {
            listeners.push(new EventListener(element, "input", (e) => {
                if (lastInputTime !== null) {
                    lastInputTime = Date.now();
                }
                handleInputEvent(
                    {
                        key,
                        element,
                        value: e.target[propertyName],
                        setValue: (newValue) => {
                            e.target[propertyName] = newValue;
                        },
                    }
                );
            }));
        }
    }

    // Listen for setting changes:

    if (setElementValue && Object.keys(setElementValue).length > 0) {
        listeners.push(new EventListener(onSettingsChanged, (changes) => {
            if (!changes) return;
            for (const [key, value] of Object.entries(changes)) {
                const setValue = setElementValue[key];
                if (setValue) {
                    if (newValuePattern) {
                        if (value && typeof value === 'object')
                            setValue(value.newValue);
                    } else {
                        setValue(value);
                    }
                }
            }
        }));
    }


    return {
        listeners,
        dispose() {
            if (isDisposed) return;
            for (const cancel of controlTimeouts) {
                cancel();
            }
            for (const listener of listeners) {
                listener.dispose();
            }
            isDisposed = true;
        },
        get isDisposed() {
            return isDisposed;
        },
        skipCurrentInputIgnore() {
            if (isDisposed) return;
            for (const control of controlTimeouts) {
                control(true);
            }
        }
    };
}
