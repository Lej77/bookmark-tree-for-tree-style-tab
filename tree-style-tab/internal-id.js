'use strict';

import {
    getGroupTabInfo,
} from '../tree-style-tab/group-tab.js';

import {
    kTST_ID,
    getTabsFromTST,
} from '../tree-style-tab/utilities.js';

import {
    EventManager,
} from '../common/events.js';

import {
    delay,
} from '../common/delays.js';


/**
 * @typedef {Object} CachedTSTInternalIdChangedInfo
 * @property {string | null} oldValue The value that was previously cached.
 * @property {string | null} newValue The value that is currently cached.
 * @property {boolean} manually True if the value was changed via the `setInternalIdCache` function; otherwise false.
 */
null;

/**
 * @typedef {import('../common/events.js').EventSubscriber<T>} EventSubscriber<T>
 * @template T
 */
null;

/** @type {null | string} */
let gCache = null;

/** @type {null | EventManager<CachedTSTInternalIdChangedInfo>} */
let gCacheChanged = null;

function setInternalIdCache_Internal(value, manually = false) {
    if (!value) {
        value = null;
    } else if (typeof value !== 'string') {
        return;
    }
    if (value === gCache) {
        return;
    }
    const oldValue = gCache;
    gCache = value;

    if (gCacheChanged) {
        gCacheChanged.fire({
            oldValue,
            newValue: value,
            manually: Boolean(manually),
        });
    }
}

/**
 * Set the cached internal id for Tree Style Tab.
 *
 * @export
 * @param {null | string} value The new internal id to store in the cache. If this is a false value then the cache is cleared.
 */
export function setInternalIdCache(value) {
    setInternalIdCache_Internal(value, true);
}
/**
 * Get an `EventSubscriber` that is invoked whenever the cached internal id for Tree Style Tab is changed.
 *
 * @export
 * @returns {EventSubscriber<CachedTSTInternalIdChangedInfo>} An `EventSubscriber` where listeners are notified with `{oldValue: null | string, newValue: null | string, manually: boolean}`.
 */
export function getInternalIdCacheChanged() {
    if (!gCacheChanged) {
        gCacheChanged = new EventManager();
    }
    return gCacheChanged.subscriber;
}


let gCurrentOperation = null;

/**
 * Use Group tab URLs to get Tree Style Tab's internal id.
 * 
 * @param {Object} Options Determines what methods are allowed for finding Tree Style Tab's id.
 * @param {boolean} Options.allowCached Get id from cache if available.
 * @param {boolean} Options.searchOpenTabs If id is not cached then search open tabs for a TST tab that contains the internal id in its URL.
 * @param {boolean} Options.openGroupTab If id is not cached then open a TST group tab that contains the internal id in its URL.
 * @returns {Promise<string>} Tree Style Tab's internal id.
 */
export async function getInternalTSTId({ allowCached = true, searchOpenTabs = true, openGroupTab = true } = {}) {
    while (gCurrentOperation) {
        let waiting = gCurrentOperation;
        await waiting;
        if (waiting === gCurrentOperation) {
            gCurrentOperation = null;
        }
    }

    if (allowCached && gCache) {
        return gCache;
    }

    gCurrentOperation = (async () => {

        let internalId;

        // #region Search for open Group Tab

        if (searchOpenTabs) {
            try {
                const allWindows = await browser.windows.getAll();

                for (const window of allWindows) {
                    if (window.incognito) continue;
                    if (internalId) break;

                    const tstTabs = await getTabsFromTST(window.id, true);
                    for (const tstTab of tstTabs) {
                        if (tstTab.states.includes('group-tab')) {
                            let url = tstTab.url;
                            if (!url) {
                                // We don't have "tabs" permission from Tree Style Tab's options page so get the tab from Firefox instead.
                                const firefoxTab = await browser.tabs.get(tstTab.id);
                                if (!('url' in firefoxTab)) {
                                    // Can't get "tabs" info from Firefox or Tree Style Tab => can't determine Tree Style Tab's internal id.
                                    console.warn('Don\'t have "tabs" permission so can\'t determine Tree Style Tab\'s internal id.');
                                    return null;
                                }
                                url = firefoxTab.url;
                            }
                            const groupURLInfo = getGroupTabInfo(url);
                            if (groupURLInfo) {
                                internalId = groupURLInfo.internalId;
                                break;
                            }
                        }
                    }
                }
            } catch (error) {
                console.error('Failed to search open tabs for a Tree Style Tab group tab.\nError:\n', error);
            }
        }

        // #endregion Search for open Group Tab


        // #region Open a new Group Tab

        if (openGroupTab && !internalId) {
            let tempTab;

            let groupTabOpened = null;
            const onCreate = async (createdTab) => {
                if (!createdTab || createdTab.windowId !== tempTab.windowId)
                    return;

                // Wait for the URL to change from 'about:blank'.
                await delay(500);

                if ('url' in createdTab) {
                    // Has "tabs" permission:
                    createdTab = await browser.tabs.get(createdTab.id);
                } else {
                    // Attempt to get URL from Tree Style Tab:
                    try {
                        // Get TST tab info:
                        createdTab = await browser.runtime.sendMessage(kTST_ID, {
                            type: 'get-tree',
                            tab: createdTab.id,
                        });
                        if (!createdTab) return;
                        if (!('url' in createdTab)) {
                            // Don't have "tabs" permission from Tree Style Tab's option page and don't have "tabs" permission from Firefox => can't determine Tree Style Tab's internal id.
                            console.warn('Don\'t have "tabs" permission so can\'t determine Tree Style Tab\'s internal id.');
                            if (groupTabOpened)
                                groupTabOpened(null);
                            return;
                        }
                    } catch (error) {
                        console.error('Failed to get tab info from TST.\nError:', error);

                        // Don't have "tabs" permission from Firefox and Tree Style Tab is not enabled => can't determine Tree Style Tab's internal id.
                        if (groupTabOpened)
                            groupTabOpened(null);
                    }
                }
                const groupURLInfo = getGroupTabInfo(createdTab.url);
                if (groupURLInfo && groupTabOpened) {
                    // A group tab was opened:
                    groupTabOpened(groupURLInfo.internalId);
                }
            };
            try {
                try {
                    tempTab = await browser.tabs.create({ active: false });
                    browser.tabs.onCreated.addListener(onCreate);
                    const groupTabOpenWaiter = new Promise((resolve, reject) => {
                        groupTabOpened = resolve;
                        setTimeout(() => reject(new Error('Timeout when waiting for group tab to be opened.')), 5000);
                    });

                    const groupTabOpenCommand = browser.runtime.sendMessage(kTST_ID, {
                        type: 'group-tabs',
                        tabs: [tempTab.id]
                    }).then(async (groupTab) => {
                        let url = groupTab && groupTab.url;
                        if (!url) {
                            const firefoxTab = await browser.tabs.get(groupTab.id);
                            url = firefoxTab.url;
                        }
                        const groupURLInfo = getGroupTabInfo(url);
                        return groupURLInfo ? groupURLInfo.internalId : null;
                    });

                    const groupTabInternalId = await Promise.race([
                        groupTabOpenWaiter,
                        groupTabOpenCommand,
                    ]);

                    if (groupTabInternalId) {
                        internalId = groupTabInternalId;
                    }
                } catch (error) {
                    console.error('Failed to open temporary Tree Style Tab group tab to get Tree Style Tab\'s internal id.\nError:\n', error);
                }
            } finally {
                if (groupTabOpened) {
                    groupTabOpened();   // Cancel waiter promise.
                }
                browser.tabs.onCreated.removeListener(onCreate);
                if (tempTab) {
                    await browser.tabs.remove(tempTab.id);
                }
            }
        }

        // #endregion Open a new Group Tab


        if (!internalId) {
            return null;
        }
        setInternalIdCache_Internal(internalId);

        return internalId;
    })();

    return gCurrentOperation;
}

/**
 * Get the URL for Tree Style Tab's sidebar page.
 *
 * @export
 * @param {string|null} internalId The internal id for Tree Style Tab.
 * @returns {string|null} The URL for Tree Style Tab's sidebar page. Will be `null` if `internalId` was `null`.
 */
export function getSidebarURL(internalId) {
    if (!internalId) return null;
    else return 'moz-extension://' + internalId + '/sidebar/sidebar.html';
}