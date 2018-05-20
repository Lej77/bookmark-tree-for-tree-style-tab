
// #region Bookmark and Restore Tree Data

/**
 * 
 * 
 * @param {Object|Array} parentTabs Parent tab(s) to bookmark together with their children tabs.
 * @param {boolean} [isTSTTab=false] The provided tabs have Tree Style Tab info.
 * @returns {Object} The parent bookmark for the tree's bookmarks.
 */
async function bookmarkTree(parentTabs, { isTSTTab = false, parentBookmarkId = null, useSeparators = false, useSeparatorsForChildren = false, useLegacyGroupTabURL = false, maxTreeDepth = false, warnWhenMoreThan = -1 } = {}) {
  if (!parentTabs && parentTabs !== 0) {
    return;
  }
  if (!Array.isArray(parentTabs)) {
    parentTabs = [parentTabs];
  }
  if (parentTabs.length === 0) {
    return;
  }
  let tstTabs = isTSTTab ? parentTabs : await getTSTTabs(parentTabs.map(tab => tab.id));

  let ignoreChildren = false;
  if (maxTreeDepth || maxTreeDepth === 0) {
    if (maxTreeDepth === true) {
      ignoreChildren = true;
    } else {
      if (maxTreeDepth <= 0) {
        ignoreChildren = true;
      }
      if (tstTabs.length <= 1) {
        maxTreeDepth--;
      }
    }
  }


  let shouldWarn = (warnWhenMoreThan || warnWhenMoreThan === 0) && (warnWhenMoreThan >= 0);
  if (tstTabs.length > 1 || shouldWarn) {
    let rootTabs = [];
    let childTabs = [];
    let processedTabIds = [];

    while (tstTabs.length > 0) {
      let parentTab = tstTabs.shift();
      if (processedTabIds.includes(parentTab.id)) {
        continue;
      }
      rootTabs.push(parentTab);
      processedTabIds.push(parentTab.id);

      childTabs.push.apply(childTabs, parentTab.children);

      while (childTabs.length > 0) {
        let childTab = childTabs.shift();
        processedTabIds.push(childTab.id);
        childTabs.push.apply(childTabs, childTab.children);
      }
    }

    if (shouldWarn && processedTabIds.length > warnWhenMoreThan) {
      let ok = await confirmWithNotification({
        title: browser.i18n.getMessage('notifications_BookmarkTree_Confirm_Title'),
        message: browser.i18n.getMessage('notifications_BookmarkTree_Confirm_Message', processedTabIds.length),
      });
      if (!ok) {
        return null;
      }
    }

    tstTabs = rootTabs;
  }


  let bookmarkDetails = {};
  if (parentBookmarkId) {
    bookmarkDetails.parentId = parentBookmarkId;
  }

  let firstTab = tstTabs[0];


  if (tstTabs.length === 1 && (firstTab.children.length === 0 || ignoreChildren)) {
    let details = { title: firstTab.title, url: firstTab.url };
    if (useLegacyGroupTabURL && firstTab.states.includes('group-tab')) {
      let groupInfo = getGroupTabInfo(firstTab.url);
      if (groupInfo) {
        details.url = kTST_LegacyGroupURL + groupInfo.urlArguments;
      }
    }
    if (bookmarkDetails) {
      Object.assign(details, bookmarkDetails);
    }
    return browser.bookmarks.create(details);
  }


  let folderBookmark;
  let bookmarks = [];
  if (!useSeparators) {
    let folderTitle = tstTabs[0].title;
    if (tstTabs.length > 1) {
      folderTitle = browser.i18n.getMessage('bookmark_MultipleTabsTitle', folderTitle);
    }
    folderTitle += settings.bookmarkSuffix;

    folderBookmark = await browser.bookmarks.create(Object.assign({
      title: folderTitle,
    }, bookmarkDetails || {}));

    parentBookmarkId = folderBookmark.id;

    if (tstTabs.length === 1) {
      let separator = await browser.bookmarks.create({
        type: 'separator',
        parentId: parentBookmarkId,
      });
    }
  } else {
    let separator = await browser.bookmarks.create(Object.assign({
      type: 'separator',
    }, bookmarkDetails || {}));
  }

  let callInfo = {
    parentBookmarkId: parentBookmarkId,
    isTSTTab: true,
    useSeparators: useSeparatorsForChildren,
    useSeparatorsForChildren: useSeparatorsForChildren,
    useLegacyGroupTabURL: useLegacyGroupTabURL,
    maxTreeDepth: maxTreeDepth,
  };

  if (tstTabs.length === 1) {
    let parentBookmark = await bookmarkTree(firstTab, Object.assign(Object.assign({}, callInfo), { maxTreeDepth: true }));
    for (let tab of firstTab.children) {
      let childBookmarks = await bookmarkTree(tab, callInfo);
      bookmarks.push(childBookmarks);
    }
  } else {
    for (let tab of tstTabs) {
      let childBookmarks = await bookmarkTree(tab, callInfo);
      bookmarks.push(childBookmarks);
    }
  }

  if (folderBookmark) {
    return folderBookmark;
  } else {
    for (let iii = 0; iii < 2; iii++) {
      let separator = await browser.bookmarks.create(Object.assign({
        type: 'separator',
      }, bookmarkDetails || {}));
    }
    return bookmarks;
  }
}


async function restoreTree({ bookmarkId, rootBookmark, parentTabId, handleParentId = null, handleParentLast = true, detachIncorrectParentAfterDelay = false, allowNonCreatedParent = false, createdTabs = [], windowId = null, supportSeparators = true, fixGroupTabURLs = false, warnWhenMoreThan = -1 } = {}) {
  if (!bookmarkId && !rootBookmark) {
    return;
  }

  if (bookmarkId && (!rootBookmark || rootBookmark.id !== bookmarkId)) {
    rootBookmark = (await browser.bookmarks.getSubTree(bookmarkId))[0];
  }

  let tabs = [];


  if ((warnWhenMoreThan || warnWhenMoreThan === 0) && (warnWhenMoreThan >= 0)) {
    let count = 0;
    let bookmarksToCount = [rootBookmark];

    while (bookmarksToCount.length > 0) {
      let aBookmark = bookmarksToCount.shift();
      if (aBookmark.type === 'bookmark') {
        count++;
      }

      if (aBookmark.children) {
        bookmarksToCount.push.apply(bookmarksToCount, aBookmark.children);
      }
    }

    if (count > warnWhenMoreThan) {
      let ok = await confirmWithNotification({
        title: browser.i18n.getMessage('notifications_RestoreTree_Confirm_Title'),
        message: browser.i18n.getMessage('notifications_RestoreTree_Confirm_Message', count),
      });
      if (!ok) {
        return tabs;
      }
    }
  }


  let callbacks = [];
  if (!handleParentId && handleParentLast) {
    handleParentId = (tab, parentTabId) => {
      callbacks.push(async () => {
        let details = {
          type: 'attach',
          parent: parentTabId,
          child: tab.id,
        };
        let index = tabs.indexOf(tab);
        if (index > 0) {
          details.insertAfter = tabs[index - 1].id;
        }

        await browser.runtime.sendMessage(kTST_ID, details);
      });
    };
  }


  switch (rootBookmark.type) {
    case 'bookmark': {
      let createDetails = { url: rootBookmark.url };

      if (createDetails.url.toLowerCase() === 'about:newtab') {
        delete createDetails.url;
      } else if (fixGroupTabURLs) {
        let groupInfo = getGroupTabInfo(createDetails.url);
        if (groupInfo) {
          createDetails.url = getGroupTabURL({ internalId: await getInternalTSTId(), urlArguments: groupInfo.urlArguments });
        }
      }

      if (parentTabId && !handleParentId) {
        createDetails.openerTabId = parentTabId;
      }
      if (windowId || windowId === 0) {
        createDetails.windowId = windowId;
      }

      let tab;
      try {
        tab = await browser.tabs.create(createDetails);
      } catch (error) {
        createDetails.url = `about:blank?${rootBookmark.url}`;
        console.log(`Failed to open "${rootBookmark.url}" open "${createDetails.url}" instead.`);
        tab = await browser.tabs.create(createDetails);
      }
      createdTabs.push(tab);

      if (settings.delayAfterTabOpen >= 0) {
        await trackedDelay(settings.delayAfterTabOpen);
      }
      if (parentTabId && handleParentId) {
        handleParentId(tab, parentTabId);
      }
      if (!parentTabId && ((detachIncorrectParentAfterDelay || detachIncorrectParentAfterDelay === 0) && (detachIncorrectParentAfterDelay === true || detachIncorrectParentAfterDelay >= 0))) {
        let detach = async () => {
          if (allowNonCreatedParent) {
            let tstTab = await getTSTTabs(tab.id);
            let { ancestorTabIds } = tstTab;
            let createdIds = createdTabs.map(tab => tab.id);
            for (let ancestorTabId of ancestorTabIds) {
              if (!createdIds.includes(ancestorTabId)) {
                return;
              }
            }
          }
          await browser.runtime.sendMessage(kTST_ID, {
            type: 'detach',
            tab: tab.id,
          });
        };
        if (detachIncorrectParentAfterDelay === true) {
          detach();
        } else {
          trackedDelay(detachIncorrectParentAfterDelay).finally(() => {
            detach();
          });
        }
      }
      tabs = [tab];
    } break;

    case 'folder': {
      let first = false;
      let oldParentTabIds = [];
      let separatorCount = 0;
      for (let bookmark of rootBookmark.children) {
        if (bookmark.type === 'separator') {
          if (tabs.length === 0) {
            first = true;
          }
          if (supportSeparators) {
            separatorCount++;
          }
          continue;
        }
        if (separatorCount > 0) {
          if (separatorCount >= 2 && oldParentTabIds.length > 0) {
            parentTabId = oldParentTabIds.pop();
          }
          if (separatorCount !== 2) {
            oldParentTabIds.push(parentTabId);
            first = true;
          }
          separatorCount = 0;
        }

        let restoredTabs = [];
        try {
          restoredTabs = await restoreTree({ rootBookmark: bookmark, parentTabId, handleParentId, detachIncorrectParentAfterDelay, allowNonCreatedParent, createdTabs, windowId, supportSeparators, fixGroupTabURLs });
        } catch (error) {
          console.log('Failed to restore bookmark:\n', bookmark, '\nError:\n', error);
        }

        if (first && restoredTabs.length > 0) {
          parentTabId = restoredTabs[0].id;
          windowId = restoredTabs[0].windowId;
          first = false;
        }
        tabs.push.apply(tabs, restoredTabs);
      }
    } break;

    case 'separator': {

    } break;
  }

  if (callbacks.length > 0) {
    for (let callback of callbacks) {
      await callback();
    }
  }

  return tabs;
}

// #endregion Bookmark and Restore Tree Data


// #region Tree Style Tab

// #region Registration

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
      title: settings.customTSTContextMenuLabel || browser.i18n.getMessage('contextMenu_BookmarkTree'),
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

// #endregion Registration


// #region Context Menu

async function createTSTContextMenuItem(item) {
  try {
    await browser.runtime.sendMessage(kTST_ID, {
      type: 'fake-contextMenu-create',
      params: item,
    });
  } catch (error) {
    return false;
  }
  return true;
}

async function removeAllTSTContextMenuItems() {
  try {
    await browser.runtime.sendMessage(kTST_ID, {
      type: 'fake-contextMenu-remove-all'
    });
  } catch (error) {
    return false;
  }
  return true;
}

// #endregion Context Menu

// #endregion Tree Style Tab


// #region Multiple Tab Handler

// #region Registration

async function registerToMTH() {
  let success = true;
  try {
    await unregisterFromMTH();

    if (!settings.hasMTHContextMenu) {
      return true;
    }

    success = await createMTHContextMenuItem('mth-bookmark-tree', settings.customMTHContextMenuLabel || browser.i18n.getMessage('contextMenu_BookmarkTree'));
  } catch (error) { return false; }

  return success;
}

async function unregisterFromMTH() {
  try {
    await removeMTHContextMenuItem('mth-bookmark-tree');
  } catch (e) { return false; }
  return true;
}

// #endregion Registration


// #region Context Menu

async function createMTHContextMenuItem(itemId, itemTitle, always = false) {
  try {
    let details = {
      type: 'add-selected-tab-command',
      id: itemId,
      title: itemTitle,
    };
    if (always) {
      details.always = true;
    }
    await browser.runtime.sendMessage(kMTH_ID, details);
  } catch (error) {
    console.log('error\n', error);
    return false;
  }
  return true;
}

async function removeMTHContextMenuItem(itemId) {
  try {
    await browser.runtime.sendMessage(kMTH_ID, {
      type: 'remove-selected-tab-command',
      id: itemId,
    });
  } catch (error) {
    return false;
  }
  return true;
}

// #endregion Context Menu

// #endregion Multiple Tab Handler


// #region Context Menu

async function updateContextMenu() {
  try {
    await browser.contextMenus.removeAll();

    for (let contextMenuId of [
      'RestoreTree',
    ]) {
      let details = {
        contexts: ['bookmark']
      };
      if (contextMenuId.startsWith('-')) {
        Object.assign(details, {
          type: 'separator',
        });
      } else {
        Object.assign(details, {
          id: contextMenuId,
          title: browser.i18n.getMessage(`contextMenu_${contextMenuId}`),
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


settingsLoaded.finally(async () => {

  // #region Settings

  let getBookmarkTreeSettings = () => {
    return {
      useSeparatorsForChildren: settings.bookmarkTreeWithSeparators,
      useLegacyGroupTabURL: settings.bookmarkGroupTabsWithLegacyURL,
      warnWhenMoreThan: settings.warnWhenBookmarkingMoreThan,
    };
  };
  let getRestoreTreeSettings = () => {
    return {
      handleParentLast: settings.setParentAfterTabCreate,
      supportSeparators: settings.allowSeparatorsWhenRestoringTree,
      fixGroupTabURLs: settings.fixGroupTabURLsOnRestore,
      warnWhenMoreThan: settings.warnWhenRestoringMoreThan,
      detachIncorrectParentAfterDelay: settings.detachIncorrectParentsAfter,
    };
  };

  handleSettingChanges = (changes, areaName) => {
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

    if (changes.delayAfterTabOpen) {
      cancelAllTrackedDelays();
    }
  };

  // #endregion Settings


  // #region Tree Stlye Tab

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
            bookmarkTree(aMessage.tab, getBookmarkTreeSettings());
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
            bookmarkTree(aMessage.selection.selected, getBookmarkTreeSettings());
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

  // #endregion Tree Stlye Tab


  // #region Context Menu

  updateContextMenu();
  browser.contextMenus.onClicked.addListener((info, tab) => {
    switch (info.menuItemId) {
      case 'RestoreTree': {
        let { bookmarkId } = info;
        restoreTree(Object.assign({ bookmarkId: bookmarkId, }, getRestoreTreeSettings()));
      } break;

      case 'BookmarkTree': {
        bookmarkTree(tab, getBookmarkTreeSettings());
      } break;
    }
  });

  // #endregion Context Menu

});
