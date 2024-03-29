'use strict';

import {
    DisposableCollection,
} from '../common/disposables.js';

import {
    delay,
    boundDelay,
} from '../common/delays.js';

import {
    getInternalIdCacheChanged,
    setInternalIdCache,
} from '../tree-style-tab/internal-id.js';

import {
    SettingsTracker,
} from '../common/settings.js';

import {
    TreeInfoNode,
} from '../background/tree-info-node.js';


/**
 * @typedef {import('../background/tree-info-node.js').BookmarkFormat} BookmarkFormat
 */


/** The values that the `type` property can have for this extension's internal messages. */
export const messageTypes = Object.freeze({
    /** Event sent when privacy info changed. */
    privacyPermissionChanged: 'privacyPermissionChanged',
    /** Get privacy info from background page. */
    privacyPermission: 'privacyPermission',
});



// #region Settings

export function getDefaultSettings() {
    return {
        // #region Context Menu

        hasRestoreTreeContextMenu: true,
        hasTabContextMenu: true,
        hasTSTContextMenu: true,
        hasMTHContextMenu: true,
        hasMigrateContextMenu: false,

        customBookmarkTreeContextMenuLabel: '',
        customRestoreTreeContextMenuLabel: '',
        customTSTContextMenuLabel: '',
        customMTHContextMenuLabel: '',
        customMigrateContextMenuLabel: '',
        customTopLevelBookmarkContextMenuLabel: '',

        // #endregion Context Menu


        // #region Change Tree Data Format

        /** @type { BookmarkFormat | 'auto' } */
        migrateTreeData_fromBookmarkFormat: TreeInfoNode.bookmarkFormat.separators,
        /** @type { BookmarkFormat } */
        migrateTreeData_toBookmarkFormat: TreeInfoNode.bookmarkFormat.titles,
        /** @type { string } */
        migrateTreeData_removeSuffix: browser.i18n.getMessage('bookmark_DefaultTSTSuffix'),
        /** @type { string } */
        migrateTreeData_addSuffix: browser.i18n.getMessage('bookmark_DefaultMigrationSuffix'),
        migrateTreeData_onlyAddSuffixIfSuffixWasRemoved: false,

        // #endregion Change Tree Data Format


        // #region Options for opening tabs

        delayAfterTabOpen: 200,
        delayBeforeNavigating: 0,
        setParentAfterTabCreate: false,
        detachIncorrectParentsAfter: 1500,

        openAsDiscardedTabs: true,
        createTempTabWhenRestoring: true,
        tempTabURL: '',
        gruopUnderTempTabWhenRestoring: true,
        ensureOneParentWhenCreatingTabs: true,
        /** This will load any ancestors of internal firefox pages (like
         * about:newtab or about:blank). This is because loaded tabs can't have
         * their `openerTabId` set to a discarded tab and internal pages can't
         * be opened as discarded. */
        openAsDiscardedTabs_fixOpenerTabIdForInternalFirefoxUrls: true,

        // #endregion Options for opening tabs


        /** A suffix that should be added to bookmark folders that were created by this extension. */
        bookmarkSuffix: browser.i18n.getMessage('bookmark_DefaultTSTSuffix'),


        // #region Format for Bookmark Tree Data

        /** @type { BookmarkFormat | 'auto' } Determines how tree data is parsed from bookmarks. Specify `auto` to auto detect what format that tree data is stored with. */
        restoreTreeWithBookmarkFormat: TreeInfoNode.bookmarkFormat.separators,
        /** @type { BookmarkFormat } Determines how tree data is saved to bookmarks. */
        bookmarkTreeWithBookmarkFormat: TreeInfoNode.bookmarkFormat.separators,

        // #endregion Format for Bookmark Tree Data


        // #region Handle Special URLs

        /** Convert tab URLs that represent Tree Style Tab group tab pages to a legacy URL that will redirect to a group tab page when opened- This will ensure that a group tab page will be opened even if Tree Style Tab's internal id has changed since the URL was saved. */
        bookmarkGroupTabsWithLegacyURL: true,
        /** Use the newer fallback URL `ext+treestyletab:group` URL instead of the `about:treestyletab-group` URL. This fallback URL was introduced in Tree Style Tab v3.1.6 and won't work in versions before that. */
        bookmarkGroupTabsWithLegacyURL_NewerFallbackURL: true,
        /** Convert bookmark URLs that represent Tree Style Tab group tab pages to their correct URL before opening them. */
        fixGroupTabURLsOnRestore: true,
        /** Open groups tabs with a URL like:
         * "moz-extension://00000000-0000-0000-0000-000000000000/sidebery/group.html#New%20Tab".
         * Sidebery will assume it is one of its group tabs that were saved
         * externally and is now using the wrong internal id and fix it up for
         * us (the relevant code runs when a sidebar is opened). See:
         * https://github.com/mbnuqw/sidebery/blob/3933196225ed0b2f713cbb7831c81a7023b579ed/src/services/tabs.bg.actions.ts#L497-L519
         */
        groupTab_restoreUsingSidebery: false,

        // #endregion Handle Special URLs


        // #region Warnings

        /** Warn before creating more than this many bookmarks. (negative to disable warning.) */
        warnWhenBookmarkingMoreThan: 200,
        /** Warn before opening more than this many tabs. (negative to disable warning.) */
        warnWhenRestoringMoreThan: 15,

        // #endregion Warnings


        /** Open a popup when misconfigured privacy permissions are detected. */
        warnAboutMisconfiguredPrivacySettings: true,


        /** Cached internal id for Tree Style Tab. */
        treeStyleTabInternalId: null,
    };
}

/**
 * Migrate settings from an older version of this extension.
 *
 * @export
 * @template {{}} T
 * @param {T} settings The settings to migrate. These should preferably be without defaults added since those might have changed.
 * @param {string} previousVersion The version of the extension that the settings come from.
 * @returns {Partial<T>} An object with values that should be changed for `settings`. Keys with `undefined` as value should be removed from the original settings.
 */
export function migrateSettings(settings, previousVersion) {
    const [major, minor] = previousVersion.split('.').map(v => parseInt(v));

    /** Determine if a specific version of the extension is affected by a legacy settings.
     *
     * @param {string} lastAffectedVersion The last version (inclusive) of this extension that needs to have its settings changed to a new format.
     * @returns {boolean} `true` if the settings are affected by a legacy setting and needs to be updated.
     */
    const affected = (lastAffectedVersion) => {
        const [majorAffected, minorAffected] = lastAffectedVersion.split('.').map(v => parseInt(v));
        if (major == majorAffected) {
            return minor <= minorAffected;
        } else {
            return major < majorAffected;
        }
    };

    /** Changes that should be applied to the current settings.
     * @type {Partial<T>}
    */
    const changes = {};
    const set = (key, value) => {
        changes[key] = value;
    };
    const remove = (key) => {
        changes[key] = undefined;
    };
    /** Get a key's value.
     *
     * Note: this will **not** use the `getDefaultSettings` function for fallback values. This is good since those fallback values might be different then the ones in the legacy version.
     * @param {string} key The key to lookup a value for.
     * @param {any} defaultValue A default value to return if the key didn't exist.
     * @returns {any} The value for the provided key.
    */
    const get = (key, defaultValue = undefined) => {
        if (key in changes) {
            return changes[key];
        } else if (key in settings) {
            return settings[key];
        } else {
            return defaultValue;
        }
    };

    // Ensure that the oldest migrations are applied first!

    if (affected('3.0')) {
        // Parse tree data from bookmarks:
        {
            const useSeparators = get('allowSeparatorsWhenRestoringTree', true);
            if (!useSeparators) {
                set('restoreTreeWithBookmarkFormat', TreeInfoNode.bookmarkFormat.folders);
            }
            remove('allowSeparatorsWhenRestoringTree');
        }
        // Save tree data to bookmarks:
        {
            const useSeparators = get('bookmarkTreeWithSeparators', true);
            if (!useSeparators) {
                set('bookmarkTreeWithBookmarkFormat', TreeInfoNode.bookmarkFormat.folders);
            }
            remove('bookmarkTreeWithSeparators');
        }
    }
    return changes;
}

export const settingsTracker = new SettingsTracker({ defaultValues: getDefaultSettings });
export const settings = settingsTracker.settings;

// eslint-disable-next-line valid-jsdoc
/**
 * Load a specific setting as fast as possible.
 *
 * @template {keyof ReturnType<typeof getDefaultSettings>} K
 * @param {K} key The key of the setting that should be loaded.
 * @returns {Promise<(ReturnType<typeof getDefaultSettings>[K])>} The value for the loaded setting.
 */
export function quickLoadSetting(key) {
    // @ts-ignore
    return SettingsTracker.get(key, getDefaultSettings()[key]);
}

// #endregion Settings



// #region Tracked Delays

const trackedDelays = new DisposableCollection();

/**
 * A delay that can be cancelled if the user's settings are changed.
 *
 * @export
 * @param {number} timeInMilliseconds The time in milliseconds to wait before resolving the returned promise.
 * @returns {Promise<boolean>} A promise that will be resolved to `true` if the delay completed or `false` if the delay was cancelled.
 */
export async function trackedDelay(timeInMilliseconds) {
    if (timeInMilliseconds < 0) {
        return true;
    }
    if (timeInMilliseconds < 50) {
        // We don't really need to worry about canceling short delays and hopefully this should have less overhead.
        await delay(timeInMilliseconds);
        return true;
    }
    return await boundDelay(timeInMilliseconds, trackedDelays);
}

/**
 * Cancel all pending delays created via `trackedDelay`. This is useful in case the user specified a really long delay in a setting and wanted to cancel all operations depending on that setting.
 *
 * @export
 */
export function cancelAllTrackedDelays() {
    trackedDelays.stop();
}

// #endregion Tracked Delays



// #region Sync cached internal id for Tree Style Tab with settings

getInternalIdCacheChanged().addListener(({ newValue }) => {
    SettingsTracker.set({ treeStyleTabInternalId: newValue });
});
settingsTracker.onChange.addListener((changes) => {
    if (changes.treeStyleTabInternalId) {
        setInternalIdCache(settings.treeStyleTabInternalId);
    }
});

// #endregion Sync cached internal id for Tree Style Tab with settings
