
const messagePrefix = 'message_';


function setTextMessages(elementsToText = null) {
    if (!Array.isArray(elementsToText)) {
        rootElement = document;
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

async function initiatePage() {
    setTextMessages();

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