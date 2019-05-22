
import {
  cancelAllTrackedDelays,
  settings,
  settingsTracker,
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


/**
 * @typedef {import('../common/utilities.js').BrowserTab} BrowserTab
 */
null;


// #region Bookmark and Restore Tree Data

/**
 * Create bookmarks for some tabs.
 * 
 * @param {BrowserTab | BrowserTab[]} parentTabs Parent tab(s) to bookmark together with their children tabs.
 * @param {Object} Config Configure how the tabs should be bookmarked.
 * @param {boolean} Config.isTSTTab The provided tabs have Tree Style Tab data.
 * @param {string | null} Config.parentBookmarkId The id of the bookmark folder to use when bookmarking the tabs.
 * @param {boolean} Config.useSeparators Use separators instead of folders when possible.
 * @param {boolean} Config.useSeparatorsForChildren Use separators instead of folders when bookmarking sub trees.
 * @param {boolean} Config.useLegacyGroupTabURL Convert Tree Style Tab's group tab URLs to use the legacy URL that is independent of Tree Style Tab's internal id.
 * @param {boolean} Config.maxTreeDepth The number of child levels from the provided parent tabs to include.
 * @param {boolean} Config.maxTotalTreeDepth The number of child levels from root tab to include.
 * @param {number} Config.warnWhenMoreThan If the number of tabs that should be bookmarked is greater than this amount then confirm with the user that they want to continue. False or negative to disable.
 * @returns {Object|Array} The bookmark folder containing the tree's bookmarks or if the parent has no children then the tab's bookmark. Will be an array with all bookmarks if useSeparators is true.
 */
async function bookmarkTree(
  parentTabs = [],
  {
    isTSTTab = false,
    parentBookmarkId = null,
    useSeparators = false,
    useSeparatorsForChildren = false,
    useLegacyGroupTabURL = false,
    maxTreeDepth = false,
    maxTotalTreeDepth = false,
    warnWhenMoreThan = -1
  } = {}
) {
  let treeNodes = await TreeInfoNode.createFromTabs(parentTabs, { isTSTTab });
  if (!treeNodes) {
    return;
  }
  if (!Array.isArray(treeNodes)) {
    treeNodes = [treeNodes];
  }
  if (treeNodes.length === 0) {
    return;
  }

  let rootNode = treeNodes[0].rootNode;

  if (useLegacyGroupTabURL) {
    await rootNode.convertGroupURL(true);
  }

  rootNode.prune({ maxTreeDepth: maxTotalTreeDepth });
  rootNode.prune({ parentNodes: treeNodes, maxTreeDepth: maxTreeDepth });


  if ((warnWhenMoreThan || warnWhenMoreThan === 0) && warnWhenMoreThan >= 0) {
    let count = rootNode.count;
    if (count > warnWhenMoreThan) {
      let ok = await confirmWithNotification({
        title: browser.i18n.getMessage('notifications_BookmarkTree_Confirm_Title'),
        message: browser.i18n.getMessage('notifications_BookmarkTree_Confirm_Message', count),
      });
      if (!ok) {
        return null;
      }
    }
  }

  return rootNode.saveAsBookmarks({
    parentBookmarkId,
    useSeparators,
    useSeparatorsForChildren,
    folderSuffix: settings.bookmarkSuffix,
    recursive: true,
  });
}


/**
 * Create tabs from some bookmarks.
 *
 * @param {Object} Config Configure how the tabs should be created.
 * @param {string} Config.bookmarkId The id for the bookmark that should be used used to create the tabs.
 * @returns {BrowserTab[]} Array of browser tab objects for the opened tabs.
 */
async function restoreTree({
  bookmarkId,
  handleParentLast = true,
  delayAfterTabOpen = () => -1,
  navigationOfOpenedTabDelay = () => -1,
  detachIncorrectParentAfterDelay = () => -1,
  allowNonCreatedParent = false,
  windowId = null,
  supportSeparators = true,
  fixGroupTabURLs = false,
  warnWhenMoreThan = -1,
  createTempTab = false,
  tempTabURL = '',
  groupUnderTempTab = false,
  ensureOneParent = false,
  openAsDiscardedTabs = false,
} = {}) {

  let clickedBookmark = (await browser.bookmarks.getSubTree(bookmarkId))[0];
  let rootBookmark = clickedBookmark;
  if (rootBookmark.type !== 'folder') {
    rootBookmark = (await browser.bookmarks.getSubTree(rootBookmark.parentId))[0];
  }

  let treeNodes = await TreeInfoNode.parseFromBookmarks({ rootBookmark, supportSeparators });
  if (!treeNodes) {
    return [];
  }
  if (!Array.isArray(treeNodes)) {
    treeNodes = [treeNodes];
  }
  if (treeNodes.length === 0) {
    return [];
  }

  /** @type TreeInfoNode */
  let rootNode = treeNodes[0].rootNode;

  if (clickedBookmark !== rootBookmark) {
    let clickedNode = rootNode.getNodeById(TreeInfoNode.instanceTypes.bookmark, clickedBookmark.id);
    rootNode = clickedNode.children.length > 0 || !clickedNode.parent ? clickedNode : clickedNode.parent;
    rootNode.parent = null;
  }

  let usingGroupTab = false;
  if (ensureOneParent && !rootNode.url && rootNode.children.length > 1 && rootNode.hasContent) {
    rootNode.url = getGroupTabURL({ name: rootNode.title });
    usingGroupTab = true;
  }


  if (tempTabURL.toLowerCase() === 'about:newtab') {
    tempTabURL = '';
  }

  if (fixGroupTabURLs) {
    await rootNode.convertGroupURL(false);

    if (tempTabURL) {
      let groupInfo = getGroupTabInfo(tempTabURL);
      if (groupInfo) {
        tempTabURL = getGroupTabURL({ internalId: await getInternalTSTId(), urlArguments: groupInfo.urlArguments });
      }
    }
  }


  if ((warnWhenMoreThan || warnWhenMoreThan === 0) && warnWhenMoreThan >= 0) {
    let count = rootNode.count;
    if (count > warnWhenMoreThan) {
      let ok = await confirmWithNotification({
        title: browser.i18n.getMessage('notifications_RestoreTree_Confirm_Title'),
        message: browser.i18n.getMessage('notifications_RestoreTree_Confirm_Message', count),
      });
      if (!ok) {
        return [];
      }
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

async function registerToTST() {
  let success = true;
  try {
    await unregisterFromTST();

    if (!settings.hasTSTContextMenu) {
      return true;
    }

    let registrationDetails = {
      type: 'register-self',
      name: browser.runtime.getManifest().name,
      listeningTypes: ['ready', 'fake-contextMenu-click'],
    };

    await browser.runtime.sendMessage(kTST_ID, registrationDetails);

    success = await createTSTContextMenuItem({
      id: 'bookmark-tree',
      title: settings.customTSTContextMenuLabel || browser.i18n.getMessage('contextMenu_TreeStyleTabAndMTH'),
    });
  } catch (error) { return false; }

  return success;
}

async function unregisterFromTST() {
  try {
    await removeAllTSTContextMenuItems();
    await browser.runtime.sendMessage(kTST_ID, { type: 'unregister-self' });
  }
  catch (e) { return false; }
  return true;
}

// #endregion Tree Style Tab


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

    let defaultValues = {};

    for (let contextMenuItem of [
      { id: 'RestoreTree', title: settings.customRestoreTreeContextMenuLabel, contexts: ['bookmark'] },
      { id: 'BookmarkTree', title: settings.customBookmarkTreeContextMenuLabel, contexts: ['tab'], enabled: settings.hasTabContextMenu },
    ]) {
      let { id, title, contexts, enabled = true, isDefaults = false } = typeof contextMenuItem === 'string' ? { id: contextMenuItem } : contextMenuItem;
      if (!enabled) {
        continue;
      }
      if (isDefaults) {
        Object.assign(defaultValues, contextMenuItem);
        return;
      }

      let details = {
        contexts: contexts || defaultValues.contexts,
      };
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


  // #region Settings

  let getBookmarkTreeSettings = () => {
    return {
      useSeparatorsForChildren: settings.bookmarkTreeWithSeparators,
      useLegacyGroupTabURL: settings.bookmarkGroupTabsWithLegacyURL,
      warnWhenMoreThan: settings.warnWhenBookmarkingMoreThan,
    };
  };
  let getRestoreTreeSettings = () => {
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

      supportSeparators: settings.allowSeparatorsWhenRestoringTree,
      fixGroupTabURLs: settings.fixGroupTabURLsOnRestore,
      warnWhenMoreThan: settings.warnWhenRestoringMoreThan,
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
      changes.hasTabContextMenu
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
  });

  // #endregion Settings


  // #region Bookmark Selected Tabs

  /**
   * Bookmark the selected tabs in a specific window. If no window id is provided the current window will be used.
   * 
   * This will attempt to use the new multiselect WebExtensions API that is supported in Firefox 64 and later. 
   * If that fails it will attempt to check if any tabs are selected in Multiple Tab Handler.
   * 
   * If multiple tabs aren't selected it will bookmark the provided tab or the active tab in the provided windoiw.
   * 
   * 
   * @returns {Array|Undefined} Saved Bookmarks
   */
  async function bookmarkSelectedTabs({ windowId = null, tab = null } = {}) {
    const tabs = await getSelectedTabs({
      majorBrowserVersion,
      windowId,
      tab,
    });

    // Bookmark Tabs:
    if (tabs.length === 0) {
      return;
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
          case 'ready': {
            // passive registration for secondary (or after) startup:
            registerToTST();
            return Promise.resolve(Boolean(settings.hasTSTContextMenu));
          } break;

          case 'fake-contextMenu-click': {
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
        let { bookmarkId } = info;
        restoreTree(Object.assign({ bookmarkId: bookmarkId, }, getRestoreTreeSettings()));
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

});
