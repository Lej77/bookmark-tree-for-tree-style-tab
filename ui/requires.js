
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

                const requiredElement = document.getElementById(requireId);
                let obj = {
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
                                enabled = requiredValue == enabled;
                            }
                        } else if (requiredElement.type === 'number') {
                            let value = parseInt(requiredElement.value);
                            if (requiredValue != null) {
                                if (requiredValue == 'NaN') {
                                    enabled = isNaN(value);
                                } else {
                                    enabled = !isNaN(value) && value == requiredValue;
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
                requiredElement.addEventListener('input', obj.listener);

                break;
            }
        }
    }
    return checkRequired;
}