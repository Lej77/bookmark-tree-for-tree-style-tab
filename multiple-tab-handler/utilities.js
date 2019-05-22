'use strict';

/**
 * Info about the current tab selection.
 * 
 * @typedef {Object} SelectionInfo
 * @property {import('../common/utilities.js').BrowserTab[]} Info.selected An array of tabs.Tabs which are selected
 * @property {import('../common/utilities.js').BrowserTab[]} Info.unselected An array of tabs.Tabs which are not selected.
 */
null;

export const kMTH_ID = 'multipletab@piro.sakura.ne.jp';

/**
 * Get the current selected tabs from Multiple Tab Handler.
 *
 * @export
 * @returns {Promise<SelectionInfo>} Info about current tab selection.
 */
export async function getSelection() {
    return await browser.runtime.sendMessage(kMTH_ID, {
        type: 'get-tab-selection'
    });
}