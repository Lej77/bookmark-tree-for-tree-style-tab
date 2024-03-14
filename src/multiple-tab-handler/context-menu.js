'use strict';

import {
    kMTH_ID,
} from '../multiple-tab-handler/utilities.js';


/**
 * Add a command to Multiple Tab Handler's context menu.
 *
 * @export
 * @param {string} id A unique ID for the command.
 * @param {string} title The name of the command which should appear as the label of its context menu item.
 * @param {boolean} [always=false] Indicate if the command should appear even if there is no selection.
 * @returns {Promise<boolean>} True if the context menu item was added successfully; otherwise false.
 */
export async function createMTHContextMenuItem(id, title, always = false) {
    try {
        const details = {
            type: 'add-selected-tab-command',
            id,
            title,
        };
        if (always) {
            details.always = true;
        }
        await browser.runtime.sendMessage(kMTH_ID, details);
    } catch (error) {
        console.error('Failed to add context menu item to Multiple Tab Handler!.\nError:\n', error);
        return false;
    }
    return true;
}

/**
 * Remove a command from Multiple Tab Handler's context menu.
 *
 * @export
 * @param {string} itemId A unique ID for the command.
 * @returns {Promise<boolean>} True if the context menu item was removed successfully; otherwise false.
 */
export async function removeMTHContextMenuItem(itemId) {
    try {
        await browser.runtime.sendMessage(kMTH_ID, {
            type: 'remove-selected-tab-command',
            id: itemId,
        });
    } catch (error) {
        console.error('Failed to remove context menu item from Multiple Tab Handler!.\nError:\n', error);
        return false;
    }
    return true;
}
