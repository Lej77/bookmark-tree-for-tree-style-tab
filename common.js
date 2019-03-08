
// #region Constants

const kTST_ID = 'treestyletab@piro.sakura.ne.jp';
const kMTH_ID = 'multipletab@piro.sakura.ne.jp';

const kTST_LegacyGroupURL = 'about:treestyletab-group';

// #endregion Constants


// #region Utilities

async function getPromiseWithResolve() {
  let aPromise;
  let aReject;
  let aResolve;
  await new Promise((resolve, reject) => {
    aPromise = new Promise((resolvePromise, rejectPromise) => {
      aResolve = resolvePromise;
      aReject = rejectPromise;
      resolve();
    });
  });
  return {
    promise: aPromise,

    resolve: aResolve,
    reject: aReject,
  };
}

let defineProperty = (obj, propertyName, get, set) => {
  let getSet = {};
  if (get) {
    getSet.get = get;
  }
  if (set) {
    getSet.set = set;
  }
  Object.defineProperty(obj, propertyName, getSet);
};

/**
 * Copy an object by serializing and then deserializing it with JSON.
 * 
 * @param {Object} value Object to copy.
 * @returns {Object} A copy of the provided object.
 */
let deepCopy = (value) => {
  if (!value) {
    return value;
  }
  if (typeof value === 'string') {
    return value;
  }
  let jsonCopy = JSON.parse(JSON.stringify(value));
  return jsonCopy;
};


// #region Delays

async function delay(timeInMilliseconds) {
  return await new Promise((resolve, reject) => timeInMilliseconds < 0 ? resolve() : setTimeout(resolve, timeInMilliseconds));
}

function safeDelay(timeInMilliseconds) {
  var resolvePromise;
  var timeoutId = setTimeout(() => {
    timeoutId = null;
    if (resolvePromise) {
      resolvePromise();
    }
  }, timeInMilliseconds);
  var cancel = () => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    if (resolvePromise) {
      resolvePromise();
    }
  };
  return {
    promise: new Promise((resolve, reject) => {
      if (timeoutId === null) {
        resolve();
      } else {
        resolvePromise = resolve;
      }
    }),
    cancel: cancel,
  };
}


// #region Tracked Delays

let trackedDelays = [];

async function trackedDelay(timeInMilliseconds) {
  if (timeInMilliseconds < 0) {
    return;
  }
  if (timeInMilliseconds < 50) {
    return delay(timeInMilliseconds);
  }
  let aDelay = safeDelay(timeInMilliseconds);
  trackedDelays.push(aDelay);
  aDelay.promise.finally(() => {
    let index;
    do {
      index = trackedDelays.indexOf(aDelay);
      trackedDelays.splice(index, 1);
    } while (index >= 0);
  });
  return aDelay.promise;
}

function cancelAllTrackedDelays() {
  for (let trackedDelay of trackedDelays) {
    trackedDelay.cancel();
  }
}

// #endregion Tracked Delays

// #endregion Delays

// #endregion Utilities


// #region Tree Style Tab

/**
 * Get tabs from Tree Style Tab. These tabs will include tree information.
 * 
 * @param {number|Array} tabIds Can be a single intiger id or multiple ids in an array.
 * @returns {Object|Array} A tab or an array of tabs.
 */
async function getTSTTabs(tabIds) {
  let details = {
    type: 'get-tree',
  };
  if (Array.isArray(tabIds)) {
    details.tabs = tabIds;
  } else {
    details.tab = tabIds;
  }
  return browser.runtime.sendMessage(kTST_ID, details);
}

async function getTabsFromTST(windowId, flatArray = false) {
  // Flat array: each tab is in the original array. If the array isn't flat then only root tabs occur in the array and the other tabs are only accessible through the tabs children property.
  let message = {
    type: 'get-tree',
    window: windowId,
  };
  if (flatArray) {
    message.tabs = '*';
  }
  return await browser.runtime.sendMessage(kTST_ID, message);
}


let gInternalTSTCaching = null;
/**
 * Use Group tabs to get Tree Style Tab's internal id.
 * 
 * @param {boolean} [allowCached=true] Get id from cache if available.
 * @param {boolean} [searchOpenTabs=true] If id is not cached then search open tabs for a TST tab that contains the internal id in its URL.
 * @param {boolean} [openGroupTab=true] If id is not cached then open a TST group tab that contains the internal id in its URL.
 * @returns {string} Tree Style Tab's internal id.
 */
async function getInternalTSTId({ allowCached = true, searchOpenTabs = true, openGroupTab = true } = {}) {
  while (gInternalTSTCaching) {
    let waiting = gInternalTSTCaching;
    await waiting;
    if (waiting === gInternalTSTCaching) {
      gInternalTSTCaching = null;
    }
  }

  if (allowCached && settings.treeStyleTabInternalId) {
    return settings.treeStyleTabInternalId;
  }

  gInternalTSTCaching = (async () => {

    let internalId;

    // #region Search for open Group Tab

    if (searchOpenTabs) {
      let allWindows = await browser.windows.getAll();

      for (let window of allWindows) {
        if (internalId) {
          break;
        }
        try {
          let tstTabs = await getTabsFromTST(window.id, true);
          for (let tstTab of tstTabs) {
            if (tstTab.states.includes('group-tab')) {
              let groupURLInfo = getGroupTabInfo(tstTab.url);
              if (groupURLInfo) {
                internalId = groupURLInfo.internalId;
                break;
              }
            }
          }
        } catch (error) { }
      }
    }

    // #endregion Search for open Group Tab


    // #region Open a new Group Tab

    if (openGroupTab && !internalId) {
      let tempTab;

      let groupTabOpened = null;
      const onCreate = async (createdTab) => {
        if (createdTab.windowId !== tempTab.windowId)
          return;
        if (!createdTab.url) {
          // Attempt to get URL from Tree Style Tab:
          try {
            // Wait for TST to cache URL:
            await delay(500);
            // Get TST tab info:
            createdTab = await browser.runtime.sendMessage(kTST_ID, {
              type: 'get-tree',
              tab: createdTab.id,
            });
          } catch (error) {
            console.error('Failed to get tab info from TST.\nError:', error);
          }
        }
        if (!createdTab) {
          return;
        }
        const groupURLInfo = getGroupTabInfo(createdTab.url);
        if (groupURLInfo && groupTabOpened) {
          // A group tab was opened:
          groupTabOpened(groupURLInfo.internalId);
        }
      };
      try {
        tempTab = await browser.tabs.create({ active: false });
        try {
          const groupTabOpenWaiter = new Promise((resolve, reject) => {
            groupTabOpened = resolve;
            browser.tabs.onCreated.addListener(onCreate);
            setTimeout(() => reject(new Error('Timeout when waiting for group tab to be opened.')), 5000);
          });

          const groupTabOpenCommand = browser.runtime.sendMessage(kTST_ID, {
            type: 'group-tabs',
            tabs: [tempTab.id]
          }).then(groupTab => {
            const groupURLInfo = getGroupTabInfo(groupTab.url);
            return groupURLInfo ? groupURLInfo.internalId : null;
          });

          let groupTabInternalId = await Promise.race([
            groupTabOpenWaiter,
            groupTabOpenCommand,
          ]);

          if (groupTabInternalId) {
            internalId = groupTabInternalId;
          }
        } catch (error) { }
      } finally {
        browser.tabs.onCreated.removeListener(onCreate)
        if (tempTab) {
          await browser.tabs.remove(tempTab.id);
        }
      }
    }

    // #endregion Open a new Group Tab


    if (!internalId) {
      return null;
    }
    browser.storage.local.set({ treeStyleTabInternalId: internalId });
    settings.treeStyleTabInternalId = internalId;

    return internalId;
  })();

  return gInternalTSTCaching;
}


function getGroupTabURL({ name = null, temporary = undefined, internalId = null, urlArguments = null } = {}) {
  let url = internalId ? 'moz-extension://' + internalId + '/resources/group-tab.html' : 'about:treestyletab-group';
  if (urlArguments || urlArguments === '') {
    url += urlArguments;
    return url;
  }
  let firstArg = true;
  let prepareForArg = () => {
    url += firstArg ? '?' : '&';
    firstArg = false;
  };
  if (name && typeof name === 'string') {
    prepareForArg();
    url += 'title=' + encodeURIComponent(name);
  }
  if (temporary !== undefined) {
    prepareForArg();
    url += 'temporary=' + (temporary ? 'true' : 'false');
  }
  return url;
}

function getGroupTabInfo(url) {
  if (!url || typeof url !== 'string') {
    return null;
  }
  let removeLength = (string, removeLength) => {
    return string.length <= removeLength ? '' : string.substr(removeLength);
  };

  let internalId = null;

  let legacyURI = 'about:treestyletab-group';
  if (url.startsWith(legacyURI)) {
    url = removeLength(url, legacyURI.length);
  } else {
    let start = 'moz-extension://';
    if (!url.startsWith(start)) {
      return null;
    }
    url = removeLength(url, start.length);

    let separatorIndex = url.indexOf('/');
    if (separatorIndex < 0) {
      return null;
    }
    internalId = url.substr(0, separatorIndex);
    url = removeLength(url, separatorIndex + 1);

    let location = 'resources/group-tab.html';
    if (!url.startsWith(location)) {
      return null;
    }
    url = removeLength(url, location.length);
  }

  let info = {
    internalId: internalId,
    urlArguments: url,
  };


  if (url.startsWith('?')) {
    url = removeLength(url, 1);

    let getInfo = (arg, id, key, handleValue) => {
      if (arg.startsWith(id)) {
        if (!Object.keys(info).includes(key)) {
          let value = removeLength(arg, id.length);
          if (handleValue && typeof handleValue === 'function') {
            value = handleValue(value);
          }
          info[key] = value;
        }
        return true;
      } else {
        return false;
      }
    };
    let tests = [
      (arg) => {
        return getInfo(arg, 'title=', 'name', (value) => {
          return decodeURIComponent(value);
        });
      },
      (arg) => {
        return getInfo(arg, 'temporary=', 'temporary', (value) => {
          value = value.toLowerCase().trim();
          return value === 'true';
        });
      },
    ];
    for (let arg of url.split('&')) {
      for (let test of tests) {
        if (test(arg)) {
          break;
        }
      }
    }
  }

  return Object.assign({
    name: 'Group',
    temporary: false,
  }, info);
}

// #endregion Tree Style Tab


// #region Notifications

let gNotificationObjs = [];
async function confirmWithNotification({ title, message, iconUrl = null }) {
  let promiseInfo;
  try {
    promiseInfo = await getPromiseWithResolve();

    const notificationOptions = {
      type: 'basic',

      title: title,
      message: message,
    };
    if (iconUrl) {
      notificationOptions.iconUrl = iconUrl;
    }
    const id = await browser.notifications.create(notificationOptions);

    const obj = {
      id: id,
      onClicked: () => {
        promiseInfo.resolve(true);
      },
      onClosed: () => {
        promiseInfo.resolve(false);
      },
    };
    gNotificationObjs.push(obj);
    
    let result = false;
    try {
      result = await promiseInfo.promise;
    } catch (error) { }

    const index = gNotificationObjs.indexOf(obj);
    if (index >= 0) {
      gNotificationObjs.splice(index, 1);
    }

    return result;
  } catch (error) {
    if (promiseInfo) {
      promiseInfo.resolve(false);
    }
    return false;
  }
}
browser.notifications.onClicked.addListener(function (notificationId) {
  for (let obj of gNotificationObjs) {
    if (obj.id === notificationId) {
      obj.onClicked();
    }
  }
});
browser.notifications.onClosed.addListener(function (notificationId) {
  for (let obj of gNotificationObjs) {
    if (obj.id === notificationId) {
      obj.onClosed();
    }
  }
});

// #endregion Notifications


// #region Settings

function getDefaultSettings() {
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


var settings = getDefaultSettings();
let changed = {};
function applySettingChanges(target, changes, fallbackToDefault = true) {
  let defaultSettings;
  let defaultSettingsKeys;

  for (let key of Object.keys(changes)) {
    if (Object.keys(changes[key]).includes('newValue')) {
      target[key] = changes[key].newValue;
    } else {
      if (fallbackToDefault && !defaultSettings) {
        defaultSettings = getDefaultSettings();
        defaultSettingsKeys = Object.keys(defaultSettings);
      }
      if (fallbackToDefault && defaultSettingsKeys.includes(key)) {
        target[key] = defaultSettings[key];
      } else {
        delete target[key];
      }
    }
  }
}
var handleSettingChanges;
browser.storage.onChanged.addListener((changes, areaName) => {
  applySettingChanges(settings, changes);
  if (changed) {
    applySettingChanges(changed, changes);
  }
  if (handleSettingChanges) {
    handleSettingChanges(changes, areaName);
  }
});
let settingsLoaded = browser.storage.local.get(null).then((value) => {
  let changedKeys = Object.keys(changed);
  for (let key of Object.keys(value)) {
    if (!changedKeys.includes(key)) {
      settings[key] = value[key];
    }
  }
  changed = null;
});

// #endregion Settings
