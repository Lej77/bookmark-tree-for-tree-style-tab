
import {
    toggleClass
} from '../ui/utilities.js';


export let requiresPrefix = 'requires_';
export let requiredValueAttribute = 'data-required-value';
export const disabledClass = 'disabled-due-to-dependent-value';
export const requiresAnyClass = 'requiresAny';

export function setRequiresPrefix(value) {
    requiresPrefix = value;
}

export function setRequiredValueAttribute(value) {
    requiredValueAttribute = value;
}

/**
 * Bind to elements with the requires class and update their style when the setting they are dependent upon is enabled or disabled.
 *
 * @export
 * @returns {function(): void} A function that will re-check each bound element and update their styling if needed. Use this if UI elements are changed without `input` events.
 */
export function bindDependantSettings() {
    const requireObjs = [];

    const checkRequired = (affectedObject = null) => {
        for (const obj of requireObjs) {
            if (affectedObject && obj !== affectedObject) {
                continue;
            }
            const changed = obj.checkEnabled();
            if (changed) {
                return checkRequired();
            }
        }
    };

    const requireAreas = Array.from(document.querySelectorAll(`*[class*='${requiresPrefix}']`));
    for (const ele of requireAreas) {
        for (const c of ele.classList) {
            if (c.length > requiresPrefix.length && c.startsWith(requiresPrefix)) {
                let requireId = c.substring(requiresPrefix.length);
                let inverted = false;
                if (requireId.startsWith('!')) {
                    requireId = requireId.slice(1);
                    inverted = true;
                }

                let requiredValue = ele.getAttribute(requiredValueAttribute);
                const requiredElement = /** @type {HTMLInputElement} */ (document.getElementById(requireId));
                const obj = {
                    listener: (e) => {
                        const changed = obj.checkEnabled();
                        if (changed) {
                            checkRequired();
                        }
                    },
                    checkEnabled: () => {
                        let enabled = false;
                        if (requiredElement.type === 'checkbox') {
                            enabled = requiredElement.checked;
                            if (requiredValue) {
                                enabled = requiredValue == String(enabled);
                            }
                        } else if (requiredElement.type === 'number') {
                            let value = parseInt(requiredElement.value);
                            if (requiredValue != null) {
                                if (requiredValue == 'NaN') {
                                    enabled = isNaN(value);
                                } else {
                                    enabled = !isNaN(value) && String(value) == requiredValue;
                                }
                            } else {
                                enabled = !isNaN(value) && value >= 0;
                            }
                        } else if (requiredValue != null) {
                            enabled = requiredElement.value == requiredValue;
                        }
                        if (inverted) {
                            enabled = !enabled;
                        }
                        /** @type {HTMLElement} */
                        let eleToCheck = requiredElement;
                        while (eleToCheck) {
                            if (enabled) {
                                break;
                            }
                            if (eleToCheck.classList.contains(disabledClass)) {
                                enabled = true;
                            }
                            eleToCheck = eleToCheck.parentElement;
                        }

                        const was = ele.classList.contains(disabledClass);
                        if (was !== !enabled) {
                            toggleClass(ele, disabledClass, !enabled);
                            return true;
                        }
                        return false;
                    },
                };
                requireObjs.push(obj);
                // TODO: should probably listen to setting changes instead of UI changes.
                requiredElement.addEventListener('input', obj.listener);

                break;
            }
        }
    }
    return checkRequired;
}