

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


// #region Settings

export function getDefaultSettings() {
  return {
    hasTabContextMenu: true,
    hasTSTContextMenu: true,
    hasMTHContextMenu: true,

    customBookmarkTreeContextMenuLabel: '',
    customRestoreTreeContextMenuLabel: '',
    customTSTContextMenuLabel: '',
    customMTHContextMenuLabel: '',


    delayAfterTabOpen: 200,
    delayBeforeNavigating: 0,
    setParentAfterTabCreate: false,
    detachIncorrectParentsAfter: 1500,

    openAsDiscardedTabs: true,
    createTempTabWhenRestoring: true,
    tempTabURL: '',
    gruopUnderTempTabWhenRestoring: true,
    ensureOneParentWhenCreatingTabs: true,


    bookmarkSuffix: browser.i18n.getMessage('bookmark_DefaultTSTSuffix'),

    allowSeparatorsWhenRestoringTree: true,
    bookmarkTreeWithSeparators: true,

    bookmarkGroupTabsWithLegacyURL: true,
    fixGroupTabURLsOnRestore: true,

    warnWhenBookmarkingMoreThan: 200,
    warnWhenRestoringMoreThan: 15,


    treeStyleTabInternalId: null,
  };
}

export const settingsTracker = new SettingsTracker({ defaultValues: getDefaultSettings });
export const settings = settingsTracker.settings;

// #endregion Settings



// #region Tracked Delays

const trackedDelays = new DisposableCollection();

export async function trackedDelay(timeInMilliseconds) {
  if (timeInMilliseconds < 0) {
    return;
  }
  if (timeInMilliseconds < 50) {
    await delay(timeInMilliseconds);
    return true;
  }
  return boundDelay(timeInMilliseconds, trackedDelays);
}

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
