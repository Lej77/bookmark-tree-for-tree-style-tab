
const messagePrefix = 'message_';


function setTextMessages(elementsToText = null) {
    if (!Array.isArray(elementsToText)) {
        let rootElement = document;
        if (elementsToText) {
            rootElement = elementsToText;
        }
        elementsToText = Array.from(rootElement.querySelectorAll(`*[class*='${messagePrefix}']`));
        if (rootElement !== document) {
            elementsToText.push(rootElement);
        }
    }
    for (let i = 0; i < elementsToText.length; i++) {
        let ele = elementsToText[i];
        for (let c of ele.classList) {
            if (c.length > messagePrefix.length && c.startsWith(messagePrefix)) {
                let messageId = c.substring(messagePrefix.length);
                ele.textContent = browser.i18n.getMessage(messageId);
                break;
            }
        }
    }
}

function bindElementIdsToSettings(settings, createListeners = true) {
    for (let key of Object.keys(settings)) {
        let element = document.getElementById(key);
        if (!element) {
            continue;
        }

        let propertyName;
        if (element.type === 'checkbox') {
            propertyName = 'checked';
        } else {
            propertyName = 'value';
        }

        element[propertyName] = settings[key];
        if (createListeners) {
            element.addEventListener("input", e => {
                let keyValue = {};
                keyValue[key] = e.target[propertyName];
                browser.storage.local.set(keyValue);
            });
        }
    }
}

function toggleClass(element, className, enabled) {
    if (enabled) {
        element.classList.add(className);
    } else {
        element.classList.remove(className);
    }
}


function createCollapsableArea(animationInfo = {}) {

    // #region Animation Info

    let setAnimationInfo = (value) => {

        // #region Check Arg

        animationInfo = value;
        if (animationInfo === undefined) {
            animationInfo = {};
        } else if (!animationInfo) {
            animationInfo = { reset: true, standard: false };
        }
        if (!Object.keys(animationInfo).includes('standard')) {
            animationInfo.standard = true;
        }
        animationInfo.reset = true;

        // #endregion Check Arg


        // #region Functions

        if (!animationInfo.update || !animationInfo.getPrefixed) {

            let changeFirstLetter = (string, toUpperCase = true) => {
                let firstLetter = string.charAt(0);
                firstLetter = toUpperCase ? firstLetter.toUpperCase() : firstLetter.toLowerCase();
                return firstLetter + string.slice(1);
            };

            // #region Get from Prefix

            if (!animationInfo.getPrefixed) {
                animationInfo.getPrefixed = (prefix) => {
                    if (!prefix || typeof prefix !== 'string') {
                        prefix = '';
                    }
                    let info = {};
                    let keys = Object.keys(animationInfo);
                    for (let key of keys) {
                        if (key.startsWith(prefix)) {
                            info[changeFirstLetter(key.slice(prefix.length), false)] = animationInfo[key];
                        }
                    }
                    return info;
                };
            }

            // #endregion Get from Prefix


            // #region Update

            if (!animationInfo.update) {
                let standardAnimationInfo = {
                    collapseDuration: 200, expandDuration: 200,
                    collapseDelay: 0, expandDelay: 0,
                    collapseTransition: '', expandTransition: '',
                    collapseDurationPerPixel: 0.4, expandDurationPerPixel: 0.4,
                    collapseBodyImmediately: true, expandBodyImmediately: true,
                };
                let resetAnimationInfo = { duration: 0, delay: 0, transition: '', durationPerPixel: 0, bodyImmediately: false };

                let applyStandardModifiers = (obj) => {
                    let standardKeys = Object.keys(resetAnimationInfo);
                    let keys = Object.keys(obj);
                    let info;
                    for (let key of standardKeys) {
                        if (keys.includes(key)) {
                            let value = obj[key];
                            let suffix = changeFirstLetter(key);
                            obj['collapse' + suffix] = value;
                            obj['expand' + suffix] = value;
                            delete obj[key];
                        }
                    }
                    return obj;
                };

                animationInfo.update = (changes) => {
                    if (changes !== animationInfo) {
                        changes = Object.assign({}, changes);
                    }

                    if (changes.reset) {
                        Object.assign(animationInfo, resetAnimationInfo);
                    }
                    delete changes.reset;

                    applyStandardModifiers(animationInfo);

                    if (changes.standard) {
                        Object.assign(animationInfo, standardAnimationInfo);
                    }
                    delete changes.standard;

                    Object.assign(animationInfo, changes);
                    applyStandardModifiers(animationInfo);
                };
            }

            // #endregion Update

        }

        // #endregion Functions


        animationInfo.update(Object.assign({}, animationInfo));
    };
    setAnimationInfo(animationInfo);

    // #endregion Animation Info


    let area = document.createElement('div');
    area.classList.add('collapsable');
    area.classList.add('section');


    let headerArea = document.createElement('div');
    headerArea.classList.add('headerArea');
    headerArea.classList.add('textNotSelectable');
    area.appendChild(headerArea);

    let hoverIndicator = document.createElement('div');
    hoverIndicator.classList.add('hoverIndicator');
    headerArea.appendChild(hoverIndicator);


    let contentWrapper = document.createElement('div');
    contentWrapper.classList.add('contentWrapper');
    area.appendChild(contentWrapper);

    let contentArea = document.createElement('div');
    contentArea.classList.add('contentArea');
    contentWrapper.appendChild(contentArea);


    headerArea.addEventListener('click', (e) => {
        let ele = e.target;
        while (ele) {
            if (ele === headerArea) {
                break;
            }
            if (ele.classList.contains('preventOpen')) {
                return;
            }
            ele = ele.parentElement;
        }
        setCollapsed(!isCollapsed);
    });


    let isCollapsed = true;
    let collapseTimeoutId = null;
    let setCollapsed = (value) => {
        if (isCollapsed === value) {
            return;
        }
        let wasCollapsed = isCollapsed;
        isCollapsed = value;

        let info = animationInfo.getPrefixed(value ? 'collapse' : 'expand');
        let { duration = 0, delay = 0, transition = '', durationPerPixel = 0, bodyImmediately = false } = info;


        if (duration <= 0 && durationPerPixel <= 0) {
            toggleClass(area, 'collapsed', value);
            toggleClass(area, 'open', !value);
            return;
        }


        if (wasCollapsed) {
            toggleClass(area, 'collapsed', true);
        }
        toggleClass(area, 'open', true);
        let wantedHeight = contentWrapper.scrollHeight;


        if (durationPerPixel > 0) {
            duration += durationPerPixel * wantedHeight;
        }

        transition = 'max-height ' + duration + 'ms ' + transition;
        if (delay > 0) {
            transition += ' ' + delay + 'ms';
        } else {
            delay = 0;
        }


        contentWrapper.style.transition = transition;
        contentWrapper.style.maxHeight = wantedHeight + 'px';
        if (bodyImmediately) {
            if (value) {
                document.body.style.minHeight = document.body.scrollHeight + 'px';
            } else {
                let minBodyHeight = document.body.scrollHeight - contentWrapper.clientHeight + wantedHeight;
                if (minBodyHeight > document.body.style.minHeight) {
                    document.body.style.minHeight = minBodyHeight + 'px';
                }
            }
        }


        let startTimeout = (callback, timeInMilliseconds) => {
            if (collapseTimeoutId !== null) {
                clearTimeout(collapseTimeoutId);
            }

            collapseTimeoutId = setTimeout(() => {
                collapseTimeoutId = null;
                callback();
            }, timeInMilliseconds);
        };

        // Ensure that max height is applied:
        contentWrapper.clientHeight;
        // Then start height change:
        toggleClass(area, 'collapsed', value);

        // Handle change completed:
        startTimeout(() => {
            toggleClass(area, 'open', !value);
            contentWrapper.style.maxHeight = null;
            contentWrapper.style.transition = null;
            document.body.style.minHeight = null;
        }, duration + delay);
    };
    setCollapsed(isCollapsed);


    let obj = {
        area: area,
        title: headerArea,
        content: contentArea,
    };
    defineProperty(obj, 'isCollapsed', () => isCollapsed, setCollapsed);
    defineProperty(obj, 'animationInfo', () => animationInfo, setAnimationInfo);
    return obj;
}


async function initiatePage() {
    setTextMessages();


    let animationInfo = { standard: false };
    let sectionAreas = document.querySelectorAll(`.sectionArea`);
    for (let area of sectionAreas) {
        let section = createCollapsableArea(animationInfo);
        section.isCollapsed = area.classList.contains('collapsed');
        section.title.classList.add('center');
        section.area.classList.add('standardFormat');
        area.parentElement.insertBefore(section.area, area);

        section.content.appendChild(area);

        if (area.children.length > 0) {
            let possibleHeaderNode = area.children[0];
            if (possibleHeaderNode.nodeName.toLowerCase() === 'header') {
                section.title.appendChild(possibleHeaderNode);
            }
        }
    }
    animationInfo.update({ standard: true });


    await settingsLoaded;
    bindElementIdsToSettings(settings);

    handleSettingChanges = (changes, areaName) => {
        if (changes.treeStyleTabInternalId) {
            document.getElementById('treeStyleTabInternalId').value = settings.treeStyleTabInternalId;
        }
    };

    document.getElementById('resetSettingsButton').addEventListener('click', async (e) => {
        let ok = confirm(browser.i18n.getMessage('options_resetSettings_Prompt'));
        if (!ok) {
            return;
        }

        // Clear settings:
        await browser.storage.local.clear();

        // Reload settings:
        bindElementIdsToSettings(settings, false);
    });
}
initiatePage();