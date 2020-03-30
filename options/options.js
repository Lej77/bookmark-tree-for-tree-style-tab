'use strict';

import {
    bindElementIdsToSettings,
} from '../ui/bind-settings.js';

import {
    setTextMessages,
    setMessagePrefix,
} from '../ui/utilities.js';

import {
    bindCollapsableAreas,
} from '../ui/collapsable.js';

import {
    setRequiresPrefix,
    bindDependantSettings,
} from '../ui/requires.js';

import {
    createShortcutsArea,
} from '../ui/shortcuts.js';

import {
    settings,
    settingsTracker,
} from '../common/common.js';

import {
    getInternalTSTId,
} from '../tree-style-tab/internal-id.js';

import {
    delay,
} from '../common/delays.js';


setMessagePrefix('message_');
setRequiresPrefix('requires_');


async function initiatePage() {
    setTextMessages();

    const collapsableInfo = bindCollapsableAreas({
        enabledCheck: [
            { element: document.getElementById('contextMenuArea'), check: () => settings.hasRestoreTreeContextMenu || settings.hasMigrateContextMenu || settings.hasTabContextMenu || settings.hasTSTContextMenu || settings.hasMTHContextMenu },
            { element: document.getElementById('contextMenu_restoreTree_Area'), check: () => settings.hasRestoreTreeContextMenu },
            { element: document.getElementById('contextMenu_migrateTreeData_Area'), check: () => settings.hasMigrateContextMenu },
            { element: document.getElementById('contextMenu_bookmarkTreeData_Area'), check: () => settings.hasTabContextMenu },
            { element: document.getElementById('contextMenu_bookmarkTreeData_TST_Area'), check: () => settings.hasTSTContextMenu },
            { element: document.getElementById('contextMenu_bookmarkTreeData_MTH_Area'), check: () => settings.hasMTHContextMenu },
        ],
    });
    const checkRequired = bindDependantSettings();

    const shortcuts = createShortcutsArea({
        commandInfos: {
            'BookmarkTree': {
                description: 'contextMenu_BookmarkTree',
            },
        },
        headerMessage: 'options_Commands_Title',
        infoMessage: 'options_Commands_Info',
        resetButtonMessage: 'options_Commands_ResetButton',
        promptButtonMessage: 'options_Commands_PromptButton',
    });
    document.getElementById('commandsArea').appendChild(shortcuts.area);

    await settingsTracker.start;
    collapsableInfo.checkAll();

    const boundSettings = bindElementIdsToSettings(settings, {
        handleInputEvent: ({ key, value, element }) => {
            if (element.type === 'number') {
                value = parseInt(value);
                if (isNaN(value))
                    return;
            }
            browser.storage.local.set({ [key]: value });
        },
        onSettingsChanged: settingsTracker.onChange,
        newValuePattern: true,
    });

    const handleLoad = () => {
        shortcuts.update(); // Keyboard Commands
        boundSettings.skipCurrentInputIgnore();
        checkRequired();
    };
    handleLoad();

    settingsTracker.onChange.addListener((changes) => {
        collapsableInfo.checkAll();
    });

    document.getElementById('resetSettingsButton').addEventListener('click', async (e) => {
        let ok = confirm(browser.i18n.getMessage('options_resetSettings_Prompt'));
        if (!ok) {
            return;
        }

        // Reset commands:
        await Promise.all((await browser.commands.getAll()).map(command => browser.commands.reset(command.name)));

        // Clear settings:
        await browser.storage.local.clear();

        // Wait for settings change to be applied:
        await delay(100);

        // Reload settings:
        handleLoad();
    });

    document.getElementById('TST_InternalId_ResetButton').addEventListener('click', (e) => {
        browser.storage.local.remove('treeStyleTabInternalId');
    });
    document.getElementById('TST_InternalId_UpdateButton').addEventListener('click', (e) => {
        let fromGroupTab = getInternalTSTId(
            {
                allowCached: false,
                searchOpenTabs: false,
                openGroupTab: true,
            });
        if (!fromGroupTab) {
            getInternalTSTId({
                allowCached: false,
                searchOpenTabs: true,
                openGroupTab: false,
            });
        }
    });
}
initiatePage();