'use strict';

import {
    getSelection,
} from '../multiple-tab-handler/utilities.js';


/**
 * @typedef {import('../common/utilities.js').BrowserTab} BrowserTab
 */
null;

/**
 * Get the selected tabs in a specific window. If no window id is provided the current window will be used.
 * 
 * This will attempt to use the new multi-select WebExtensions API that is supported in Firefox 64 and later. 
 * If that fails it will attempt to check if any tabs are selected in Multiple Tab Handler.
 * 
 * If multiple tabs aren't selected it will bookmark the provided tab or the active tab in the provided window.
 * 
 * @param {Object} Config Configuration for the operation.
 * @param {number} Config.majorBrowserVersion The browsers major version.
 * @param {null | number} Config.windowId The id for window to get tabs from. If `null` then get tabs from the current window.
 * @param {null | BrowserTab} Config.tab The fallback tab to use if multiple tabs aren't selected.
 * @returns {Promise<BrowserTab[]>} If multiple tabs are selected then they are returned otherwise the provided tab is returned or the current tab if no tab was provided.
 */
export async function getSelectedTabs({ majorBrowserVersion = 0, windowId = null, tab = null } = {}) {
    // Check Function Args:
    if (tab !== null) {
        windowId = tab.windowId;
    }

    // Configure Tabs Query:
    let details = { highlighted: true };
    if (windowId !== null) {
        details.windowId = windowId;
    } else {
        details.currentWindow = true;
    }

    // Attempt Tabs Query:
    let tabs = [];
    try {
        // Attempt to get multi-selected tabs from the WebExtensions API:
        tabs = await browser.tabs.query(details);
    } catch (error) { }

    // Fallback to MTH Query:
    if (majorBrowserVersion < 64 && tabs.length <= 1) {
        try {
            // Attempt to get multi-selected tabs from Multiple Tab Handler:
            var selectionInfo = await getSelection();
            let selection = selectionInfo.selected;

            if (selection.length > 0) {
                if (windowId === null) {
                    // Get window id for filtering:
                    let window = null;
                    try {
                        window = await browser.windows.get(browser.windows.WINDOW_ID_CURRENT);
                    } catch (error) {
                        try {
                            window = await browser.windows.getCurrent();
                        } catch (error) { }
                    }
                    if (window !== null) {
                        windowId = window.id;
                    }
                }

                // Filter tabs based on window id:
                tabs = windowId === null ? selection : selection.filter(tab => tab.windowId = windowId);
            }
        } catch (error) { }
    }

    // Check if not multiple selected tabs:
    if (tabs.length <= 1 && tab !== null) {
        // Not multiple selected tabs => Use the provided tab instead:
        tabs = [tab];
    } else if (tabs.length === 0) {
        // No provided tab => Attempts to get the current active tab:
        delete details.highlighted;
        details.active = true;
        tabs = await browser.tabs.query(details);
    }

    return tabs;
}
