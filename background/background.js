'use strict';

import {
    cancelAllTrackedDelays,
    settings,
    settingsTracker,
    migrateSettings,
    messageTypes,
} from '../common/common.js';

import {
    confirmWithNotification,
} from '../common/notifications.js';

import {
    kTST_ID,
} from '../tree-style-tab/utilities.js';

import {
    getGroupTabInfo,
    getGroupTabURL,
} from '../tree-style-tab/group-tab.js';

import {
    getInternalTSTId,
} from '../tree-style-tab/internal-id.js';

import {
    createTSTContextMenuItem,
    removeAllTSTContextMenuItems,
} from '../tree-style-tab/context-menu.js';

import {
    TreeInfoNode,
} from '../background/tree-info-node.js';

import {
    getSelectedTabs,
} from '../common/selected-tabs.js';

import {
    kMTH_ID,
} from '../multiple-tab-handler/utilities.js';

import {
    createMTHContextMenuItem,
    removeMTHContextMenuItem,
} from '../multiple-tab-handler/context-menu.js';

import {
    SettingsTracker
} from '../common/settings.js';

import {
    PrivatePermissionDetector
} from '../common/private-permission-detector.js';

import {
    TSTPrivacyPermissionChecker
} from '../tree-style-tab/check-privacy-permissions.js';

import {
    PortManager
} from '../common/connections.js';


/**
 * @typedef {import('../common/utilities.js').BrowserTab} BrowserTab
 */
/**
 * @typedef {import('../background/tree-info-node.js').BookmarkFormat} BookmarkFormat
 */
/**
 * @typedef {import('../background/tree-info-node.js').BookmarkTreeNode} BookmarkTreeNode
 */


// #region Bookmark and Restore Tree Data

/**
 * Migrate bookmarks with tree data from one format to another.
 *
 * @param {Object} [Config] Configure how the bookmark data should be changed.
 * @param {string} [Config.bookmarkId] The id for the bookmark folder that should have its data format changed.
 * @param {BookmarkFormat | 'auto'} [Config.fromBookmarkFormat] The tree data format that should be used to parse tree data.
 * @param {BookmarkFormat} [Config.toBookmarkFormat] The tree data format that the new migrated bookmarks should be saved with.
 * @param {string} [Config.removeSuffix] A suffix to remove from the original bookmark folder.
 * @param {string} [Config.addSuffix] A suffix to add the created bookmark folder.
 * @param {boolean} [Config.onlyAddSuffixIfSuffixWasRemoved] Only add the suffix to the created bookmark folder if the original folder had a suffix that could be removed.
 * @returns {Promise<BookmarkTreeNode[]>} The created bookmarks.
 */
async function migrateTreeData({
    bookmarkId,
    fromBookmarkFormat = 'auto',
    toBookmarkFormat,
    removeSuffix = '',
    addSuffix = '',
    onlyAddSuffixIfSuffixWasRemoved = false,
} = {}) {

    const { rootNode, rootBookmark } = await getBookmarkTreeData({ bookmarkId, bookmarkFormat: fromBookmarkFormat });
    if (!rootNode) {
        // Could be an empty folder.
        return [];
    }

    let wantedFolderTitle = rootBookmark.title;
    if (wantedFolderTitle.endsWith(removeSuffix)) {
        wantedFolderTitle = wantedFolderTitle.substr(0, wantedFolderTitle.length - removeSuffix.length);
    } else if (onlyAddSuffixIfSuffixWasRemoved) {
        addSuffix = '';
    }

    const bookmarkFolder = await browser.bookmarks.create({
        type: 'folder',
        title: wantedFolderTitle + addSuffix,
        // Create the migrated folder right next to the original folder:
        index: rootBookmark.index + 1,
        parentId: rootBookmark.parentId,
    });

    return rootNode.saveAsBookmarks({
        parentBookmarkId: bookmarkFolder.id,
        format: toBookmarkFormat || TreeInfoNode.bookmarkFormat.titles,
        // Affects any sub folders (relevant for folders data format):
        folderSuffix: addSuffix,
    });
}


/**
 * Create bookmarks for some tabs.
 *
 * @param {BrowserTab | BrowserTab[]} parentTabs Parent tab(s) to bookmark together with their children tabs.
 * @param {Object} [Config] Configure how the tabs should be bookmarked.
 * @param {boolean} [Config.isTSTTab] The provided tabs have Tree Style Tab data.
 * @param {string | null} [Config.parentBookmarkId] The id of the bookmark folder to use when bookmarking the tabs.
 * @param {BookmarkFormat} [Config.bookmarkFormat] Determines how tree data is stored in the bookmarks.
 * @param {boolean} [Config.useLegacyGroupTabURL] Convert Tree Style Tab's group tab URLs to use the legacy URL that is independent of Tree Style Tab's internal id.
 * @param {boolean} [Config.newGroupTabFallbackURL] Use the newer web extension Tree Style Tab fallback URL "ext+treestyletab:group" which replaces the older "about:treestyletab-group" URL.
 * @param {boolean | number} [Config.maxTreeDepth] The number of child levels from the provided parent tabs to include.
 * @param {boolean | number} [Config.maxTotalTreeDepth] The number of child levels from root tab to include.
 * @param {number} [Config.warnWhenMoreThan] If the number of tabs that should be bookmarked is greater than this amount then confirm with the user that they want to continue. False or negative to disable.
 * @param {string} [Config.folderSuffix] This suffix will be appended to the created bookmark folder's name.
 * @returns {Promise<BookmarkTreeNode[]>} The created bookmarks.
 */
async function bookmarkTree(
    parentTabs = [],
    {
        isTSTTab = false,
        parentBookmarkId = null,
        bookmarkFormat = null,
        useLegacyGroupTabURL = false,
        newGroupTabFallbackURL = false,
        maxTreeDepth = false,
        maxTotalTreeDepth = false,
        warnWhenMoreThan = -1,
        folderSuffix = '',
    } = {}
) {
    let treeNodes = await TreeInfoNode.createFromTabs(parentTabs, { isTSTTab });
    if (!treeNodes) return null;
    if (!Array.isArray(treeNodes)) {
        treeNodes = [treeNodes];
    }
    if (treeNodes.length === 0) return null;

    /** @type {TreeInfoNode} */
    const rootNode = treeNodes[0].rootNode;

    if (useLegacyGroupTabURL) {
        // Fix group tab URLs (don't use URLs that are dependent on Tree Style Tab's internal id since that might change and cause the URLs to not work later):
        await rootNode.convertGroupURL({ useLegacyURL: true, newFallbackURL: newGroupTabFallbackURL });
    }

    // This might remove some selected tree nodes if they are too deep:
    rootNode.prune({ maxTreeDepth: maxTotalTreeDepth });
    // Ensure only nodes close the selected nodes are kept:
    rootNode.prune({ parentNodes: treeNodes, maxTreeDepth: maxTreeDepth });

    if ((warnWhenMoreThan || warnWhenMoreThan === 0) && warnWhenMoreThan >= 0) {
        const count = rootNode.count;
        if (count > warnWhenMoreThan) {
            const ok = await confirmWithNotification({
                title: browser.i18n.getMessage('notifications_BookmarkTree_Confirm_Title'),
                message: browser.i18n.getMessage('notifications_BookmarkTree_Confirm_Message', count),
            });
            if (!ok) return null;
        }
    }

    return rootNode.saveAsBookmarks({
        parentBookmarkId,
        format: bookmarkFormat || TreeInfoNode.bookmarkFormat.separators,
        folderSuffix,
        // Create a folder if more than one bookmark will be created:
        inFolder: Boolean(rootNode.getNthContentNode(rootNode.url ? /* Has URL => find at least one child content node */ 0 :  /* No URL => find at least two child content nodes: */ 1)),
    });
}


/**
 * Get tree data from bookmarks.
 *
 * @param {Object} Config Determine how to get the tree data.
 * @param {string} Config.bookmarkId The id of the bookmark that the user clicked or that is otherwise of interest.
 * @param {BookmarkFormat | 'auto'} [Config.bookmarkFormat] The format that should be used to parse the tree data.
 */
async function getBookmarkTreeData({
    bookmarkId,
    bookmarkFormat = 'auto',
}) {

    /** @type {BookmarkTreeNode} */
    const clickedBookmark = (await browser.bookmarks.getSubTree(bookmarkId))[0];
    /** @type {BookmarkTreeNode} */
    let rootBookmark = clickedBookmark;
    if (rootBookmark.type !== 'folder') {
        rootBookmark = (await browser.bookmarks.getSubTree(rootBookmark.parentId))[0];
    }

    if (!bookmarkFormat || bookmarkFormat === 'auto') {
        bookmarkFormat = TreeInfoNode.guessBookmarkFormat({ rootBookmark });
        console.log('Auto detect tree data format for bookmarks - Decided on: ', bookmarkFormat);
    }

    /** @type {TreeInfoNode[]} */
    let treeNodes = /** @type {any} */ (await TreeInfoNode.parseFromBookmarks({ rootBookmark, format: bookmarkFormat, }));
    if (treeNodes && !Array.isArray(treeNodes)) {
        treeNodes = [treeNodes];
    }

    /** @type {TreeInfoNode | null} */
    let rootNode = null;
    /** @type {TreeInfoNode | null} */
    let clickedNode = null;
    if (treeNodes && treeNodes.length > 0) {
        rootNode = treeNodes[0].rootNode;

        if (clickedBookmark !== rootBookmark) {
            clickedNode = rootNode.getNodeById(TreeInfoNode.instanceTypes.bookmark, clickedBookmark.id);
            rootNode = clickedNode.children.length > 0 || !clickedNode.parent ? clickedNode : clickedNode.parent;
            rootNode.parent = null;
        }
    }

    return {
        rootBookmark,
        clickedBookmark,
        rootNode,
        clickedNode,
    };
}


/**
 * Create tabs from some bookmarks.
 *
 * @param {Object} Config Configure how the tabs should be created.
 * @param {string} Config.bookmarkId The id for the bookmark that should be used used to create the tabs.
 * @param {any} [Config.handleParentLast = true] TODO
 * @param {any} [Config.delayAfterTabOpen = () => -1] TODO
 * @param {any} [Config.navigationOfOpenedTabDelay = () => -1] TODO
 * @param {any} [Config.detachIncorrectParentAfterDelay = () => -1] TODO
 * @param {any} [Config.allowNonCreatedParent = false] TODO
 * @param {number} [Config.windowId = null] TODO
 * @param {BookmarkFormat | 'auto'} [Config.bookmarkFormat] The tree data format that should be used to parse tree data.
 * @param {any} [Config.fixGroupTabURLs = false] TODO
 * @param {any} [Config.warnWhenMoreThan = -1] TODO
 * @param {any} [Config.createTempTab = false] TODO
 * @param {any} [Config.tempTabURL = ''] TODO
 * @param {any} [Config.groupUnderTempTab = false] TODO
 * @param {any} [Config.ensureOneParent = false] TODO
 * @param {any} [Config.openAsDiscardedTabs = false] TODO
 * @returns {Promise<BrowserTab[]>} Array of browser tab objects for the opened tabs.
 */
async function restoreTree({
    bookmarkId,
    handleParentLast = true,
    delayAfterTabOpen = () => -1,
    navigationOfOpenedTabDelay = () => -1,
    detachIncorrectParentAfterDelay = () => -1,
    allowNonCreatedParent = false,
    windowId = null,
    bookmarkFormat = 'auto',
    fixGroupTabURLs = false,
    warnWhenMoreThan = -1,
    createTempTab = false,
    tempTabURL = '',
    groupUnderTempTab = false,
    ensureOneParent = false,
    openAsDiscardedTabs = false,
}) {

    const { rootNode } = await getBookmarkTreeData({ bookmarkId, bookmarkFormat });

    if (!rootNode) {
        // Could be an empty folder.
        return [];
    }

    if (ensureOneParent && !rootNode.url && rootNode.children.length > 1 && rootNode.hasContent) {
        rootNode.url = getGroupTabURL({ name: rootNode.title });
    }

    if (tempTabURL.toLowerCase() === 'about:newtab') {
        tempTabURL = '';
    }

    if (fixGroupTabURLs) {
        await rootNode.convertGroupURL({ useLegacyURL: false });

        if (tempTabURL) {
            const groupInfo = getGroupTabInfo(tempTabURL);
            if (groupInfo) tempTabURL = getGroupTabURL({ internalId: await getInternalTSTId(), urlArguments: groupInfo.urlArguments });
        }
    }


    if ((warnWhenMoreThan || warnWhenMoreThan === 0) && warnWhenMoreThan >= 0) {
        const count = rootNode.count;
        if (count > warnWhenMoreThan) {
            const ok = await confirmWithNotification({
                title: browser.i18n.getMessage('notifications_RestoreTree_Confirm_Title'),
                message: browser.i18n.getMessage('notifications_RestoreTree_Confirm_Message', count),
            });
            if (!ok) return [];
        }
    }

    return rootNode.openAsTabs({
        windowId,

        delayAfterTabOpen,
        navigationOfOpenedTabDelay,
        detachIncorrectParentAfterDelay,

        handleParentLast,
        allowNonCreatedParent,

        createTempTab,
        tempTabURL,
        groupUnderTempTab,

        openAsDiscardedTabs,
        dontFocusOnNewTabs: openAsDiscardedTabs,
    });
}

// #endregion Bookmark and Restore Tree Data


// #region Tree Style Tab

/**
 * Registration info from Tree Style Tab. Only available for Tree Style Tab version 3.0.12 or later.
 * @typedef {Object} RegistrationInfo
 * @property {string[]} grantedPermissions Currently granted permissions.
 * @property {boolean} privateWindowAllowed A boolean, indicating allowed (or not) to be notified messages from private windows.
 */

/** @type {null | boolean | RegistrationInfo} */
let latestTstRegistrationInfo = null;

async function registerToTST() {
    let success = true;
    try {
        await unregisterFromTST();

        const registrationDetails = {
            type: 'register-self',
            name: browser.runtime.getManifest().name,
            listeningTypes: ['ready', 'permissions-changed'],
        };
        if (settings.hasTSTContextMenu) {
            registrationDetails.listeningTypes.push('fake-contextMenu-click');
        }

        latestTstRegistrationInfo = await browser.runtime.sendMessage(kTST_ID, registrationDetails);

        if (settings.hasTSTContextMenu) {
            success = await createTSTContextMenuItem({
                id: 'bookmark-tree',
                title: settings.customTSTContextMenuLabel || browser.i18n.getMessage('contextMenu_TreeStyleTabAndMTH'),
            });
        }

        notifyPrivacyInfo();
    } catch (error) { return false; }

    return success;
}

async function unregisterFromTST() {
    try {
        await removeAllTSTContextMenuItems();
        await browser.runtime.sendMessage(kTST_ID, { type: 'unregister-self' });
        latestTstRegistrationInfo = null;
    }
    catch (e) { return false; }
    return true;
}

// #endregion Tree Style Tab


// #region Handle misconfigured privacy permissions

const privatePermission = new PrivatePermissionDetector();
let tstNotifiedAboutPrivateWindow = false;

const getPrivacyInfo = () => {
    const info = TSTPrivacyPermissionChecker.createInfo({ detector: privatePermission, tstNotifiedAboutPrivateWindow, });
    if (latestTstRegistrationInfo !== null) {
        info.tstPermission = null;
        if (latestTstRegistrationInfo && typeof latestTstRegistrationInfo === 'object') {
            info.tstPermission = Boolean(latestTstRegistrationInfo.privateWindowAllowed);
        }
    }
    return info;
};

const tstPrivacyIssues = new TSTPrivacyPermissionChecker();
tstPrivacyIssues.autoUpdatePopup = false;

const notifyPrivacyInfo = () => {
    tstPrivacyIssues.provideInfo(getPrivacyInfo());
};
privatePermission.promise.then(() => {
    notifyPrivacyInfo();
});

// #endregion Handle misconfigured privacy permissions


// #region Multiple Tab Handler

async function registerToMTH() {
    let success = true;
    try {
        await removeMTHContextMenuItem('mth-bookmark-tree');

        if (!settings.hasMTHContextMenu) {
            return true;
        }

        success = await createMTHContextMenuItem('mth-bookmark-tree', settings.customMTHContextMenuLabel || browser.i18n.getMessage('contextMenu_TreeStyleTabAndMTH'));
    } catch (error) { return false; }

    return success;
}

// #endregion Multiple Tab Handler


// #region Context Menu

async function updateContextMenu() {
    try {
        await browser.contextMenus.removeAll();

        let bookmarkParentId = null;
        if (settings.hasRestoreTreeContextMenu && settings.hasMigrateContextMenu) {
            bookmarkParentId = await browser.contextMenus.create({
                contexts: ['bookmark'],
                title: settings.customTopLevelBookmarkContextMenuLabel || browser.i18n.getMessage(`contextMenu_BookmarkTopLevelDefaultLabel`),
            });
        }

        const defaultValues = {};

        for (const contextMenuItem of [
            { id: 'RestoreTree', title: settings.customRestoreTreeContextMenuLabel, contexts: ['bookmark'], enabled: settings.hasRestoreTreeContextMenu, parentId: bookmarkParentId, },
            { id: 'MigrateTreeData', title: settings.customMigrateContextMenuLabel, contexts: ['bookmark'], enabled: settings.hasMigrateContextMenu, parentId: bookmarkParentId, },
            { id: 'BookmarkTree', title: settings.customBookmarkTreeContextMenuLabel, contexts: ['tab'], enabled: settings.hasTabContextMenu },
        ]) {
            const { id, title, contexts, enabled = true, isDefaults = false, parentId = null } = typeof contextMenuItem === 'string' ? /** @type {Object} */ ({ id: contextMenuItem }) : contextMenuItem;
            if (!enabled) {
                continue;
            }
            if (isDefaults) {
                Object.assign(defaultValues, contextMenuItem);
                return;
            }

            const details = {
                contexts: contexts || defaultValues.contexts,
            };
            if (parentId) {
                details.parentId = parentId;
            }
            if (id.startsWith('-')) {
                Object.assign(details, {
                    type: 'separator',
                });
            } else {
                Object.assign(details, {
                    id: id,
                    title: title || browser.i18n.getMessage(`contextMenu_${id}`),
                });
            }
            await browser.contextMenus.create(details);
        }
    } catch (error) {
        console.error('Failed to update context menu items: ', error);
        return false;
    }
    return true;
}

// #endregion Context Menu


settingsTracker.start.finally(async () => {

    // #region Browser Version

    let browserInfo = {};
    let majorBrowserVersion = 60;
    try {
        browserInfo = await browser.runtime.getBrowserInfo();
        majorBrowserVersion = browserInfo.version.split('.')[0];
    } catch (error) { }

    // #endregion Browser Version


    // #region Handle legacy settings

    browser.runtime.onInstalled.addListener(async (details) => {
        if ('previousVersion' in details) {
            // Extension was updated!
            const promises = [];
            const changes = migrateSettings(await SettingsTracker.get(null), details.previousVersion);
            for (const [key, value] of Object.entries(changes)) {
                if (value === undefined) {
                    promises.push(SettingsTracker.remove(key));
                } else {
                    promises.push(SettingsTracker.set(key, value));
                }
            }
            await Promise.all(promises);
        }
    });

    // #endregion Handle legacy settings


    // #region Settings

    const getBookmarkTreeSettings = () => {
        return {
            bookmarkFormat: settings.bookmarkTreeWithBookmarkFormat,
            useLegacyGroupTabURL: settings.bookmarkGroupTabsWithLegacyURL,
            newGroupTabFallbackURL: settings.bookmarkGroupTabsWithLegacyURL_NewerFallbackURL,
            warnWhenMoreThan: settings.warnWhenBookmarkingMoreThan,
            folderSuffix: settings.bookmarkSuffix,
        };
    };
    const getRestoreTreeSettings = () => {
        const asDiscarded = majorBrowserVersion >= 63 && settings.openAsDiscardedTabs;
        return {
            handleParentLast: settings.setParentAfterTabCreate,

            delayAfterTabOpen: () => settings.delayAfterTabOpen,
            navigationOfOpenedTabDelay: () => asDiscarded ? -1 : settings.delayBeforeNavigating,
            detachIncorrectParentAfterDelay: () => settings.detachIncorrectParentsAfter,

            createTempTab: settings.createTempTabWhenRestoring,
            tempTabURL: settings.tempTabURL,
            groupUnderTempTab: settings.gruopUnderTempTabWhenRestoring,
            ensureOneParent: settings.ensureOneParentWhenCreatingTabs,
            openAsDiscardedTabs: asDiscarded,

            bookmarkFormat: settings.restoreTreeWithBookmarkFormat,

            fixGroupTabURLs: settings.fixGroupTabURLsOnRestore,
            warnWhenMoreThan: settings.warnWhenRestoringMoreThan,
        };
    };
    const getMigrateTreeSettings = () => {
        return {
            fromBookmarkFormat: settings.migrateTreeData_fromBookmarkFormat,
            toBookmarkFormat: settings.migrateTreeData_toBookmarkFormat,
            removeSuffix: settings.migrateTreeData_removeSuffix,
            addSuffix: settings.migrateTreeData_addSuffix,
            onlyAddSuffixIfSuffixWasRemoved: settings.migrateTreeData_onlyAddSuffixIfSuffixWasRemoved,
        };
    };

    settingsTracker.onChange.addListener((changes) => {
        if (
            changes.hasTSTContextMenu ||
            changes.customTSTContextMenuLabel
        ) {
            registerToTST();
        }

        if (
            changes.hasMTHContextMenu ||
            changes.customMTHContextMenuLabel
        ) {
            registerToMTH();
        }

        if (
            changes.customRestoreTreeContextMenuLabel ||
            changes.customBookmarkTreeContextMenuLabel ||
            changes.customMigrateContextMenuLabel ||
            changes.hasTabContextMenu ||
            changes.hasRestoreTreeContextMenu ||
            changes.hasMigrateContextMenu ||
            changes.customTopLevelBookmarkContextMenuLabel
        ) {
            updateContextMenu();
        }

        if (
            changes.delayAfterTabOpen ||
            changes.detachIncorrectParentsAfter ||
            changes.delayBeforeNavigating
        ) {
            cancelAllTrackedDelays();
        }

        if (changes.warnAboutMisconfiguredPrivacySettings) {
            tstPrivacyIssues.autoUpdatePopup = settings.warnAboutMisconfiguredPrivacySettings;
        }
    });
    tstPrivacyIssues.autoUpdatePopup = settings.warnAboutMisconfiguredPrivacySettings;

    // #endregion Settings


    // #region Bookmark Selected Tabs

    /**
     * Bookmark the selected tabs in a specific window. If no window id is provided the current window will be used.
     *
     * This will attempt to use the new multiselect WebExtensions API that is supported in Firefox 64 and later.
     * If that fails it will attempt to check if any tabs are selected in Multiple Tab Handler.
     *
     * If multiple tabs aren't selected it will bookmark the provided tab or the active tab in the provided window.
     *
     *
     * @returns {Promise<BookmarkTreeNode[]>} Saved Bookmarks
     */
    async function bookmarkSelectedTabs({ windowId = null, tab = null } = {}) {
        const tabs = await getSelectedTabs({
            majorBrowserVersion,
            windowId,
            tab,
        });

        // Bookmark Tabs:
        if (tabs.length === 0) {
            return [];
        } else if (tabs.length === 1) {
            // Bookmark tree with all of its children:
            return bookmarkTree(tabs[0], getBookmarkTreeSettings());
        } else {
            // Bookmark only the selected tabs (not their children, but preserve parent-child relationships).
            return bookmarkTree(tabs, Object.assign({ maxTreeDepth: 0 }, getBookmarkTreeSettings()));
        }
    }

    // #endregion Bookmark Selected Tabs


    // #region External Messages from Tree Style Tab & Multiple Tab Handler

    browser.runtime.onMessageExternal.addListener((aMessage, aSender) => {
        switch (aSender.id) {
            case kTST_ID: {
                switch (aMessage.type) {
                    // Permission changed might require injecting style changes again.
                    case 'permissions-changed':
                    case 'ready': {
                        // passive registration for secondary (or after) startup:
                        registerToTST();
                        return Promise.resolve(true);
                    } break;

                    case 'fake-contextMenu-click': {
                        if (aMessage.tab.incognito && !tstNotifiedAboutPrivateWindow) {
                            tstNotifiedAboutPrivateWindow = true;
                            notifyPrivacyInfo();
                        }
                        bookmarkSelectedTabs({ tab: aMessage.tab });
                        return Promise.resolve(true);
                    } break;
                }
            } break;

            case kMTH_ID: {
                switch (aMessage.type) {
                    case 'ready': {
                        // passive registration for secondary (or after) startup:
                        registerToMTH();
                        return Promise.resolve(Boolean(settings.hasMTHContextMenu));
                    } break;

                    case 'selected-tab-command': {
                        bookmarkTree(aMessage.selection.selected, Object.assign({ maxTreeDepth: 0 }, getBookmarkTreeSettings()));
                        return Promise.resolve(true);
                    } break;
                }
            } break;
        }
    });
    if (!registerToTST()) {
        setTimeout(registerToTST, 5000);
    }
    if (!registerToMTH()) {
        setTimeout(registerToMTH, 5000);
    }

    // #endregion External Messages from Tree Style Tab & Multiple Tab Handler


    // #region Context Menu

    browser.contextMenus.onClicked.addListener((info, tab) => {
        switch (info.menuItemId) {
            case 'RestoreTree': {
                const { bookmarkId } = info;
                restoreTree(Object.assign({ bookmarkId, }, getRestoreTreeSettings()));
            } break;

            case 'MigrateTreeData': {
                const { bookmarkId } = info;
                migrateTreeData(Object.assign({ bookmarkId }, getMigrateTreeSettings()));
            } break;

            case 'BookmarkTree': {
                bookmarkSelectedTabs({ tab: tab });
            } break;
        }
    });
    updateContextMenu();

    // #endregion Context Menu


    // #region Keyboard Commands

    browser.commands.onCommand.addListener(function (command) {
        switch (command) {
            case 'BookmarkTree': {
                bookmarkSelectedTabs();
            } break;
        }
    });

    // #endregion Keyboard Commands


    // #region Internal Messaging

    const portManager = new PortManager();
    portManager.onMessage.addListener(async (message, sender, disposables) => {
        if (!message.type) {
            return;
        }
        switch (message.type) {
            case messageTypes.privacyPermission: {
                return getPrivacyInfo();
            }
        }
    });
    tstPrivacyIssues.onPrivacyInfoChanged.addListener((info) => {
        portManager.fireEvent(messageTypes.privacyPermissionChanged, [info]);
    });

    // #endregion Internal Messaging

});
