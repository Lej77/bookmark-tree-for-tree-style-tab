
// #region Bookmark and Restore Tree Data

class TreeInfoNode {

  constructor({ title, url, children = [], parent = null, instances = {} } = {}) {
    Object.assign(this, {
      _title: title || '',
      _url: url || '',
      _children: [],
      _parent: null,
      _instances: {},
    });

    this.addInstances(instances);

    this.addChildren(children);
    this.parent = parent;
  }


  // #region Node Relationships

  addChildren(nodes) {
    if (!nodes) {
      return;
    }
    if (!Array.isArray(nodes)) {
      nodes = [nodes];
    } else if (nodes.length > 0) {
      nodes = nodes.slice();
    } else {
      return;
    }

    for (let node of nodes) {
      if (node === this) {
        continue;
      }
      if (!this._children.includes(node)) {
        this._children.push(node);
      }
      if (node._parent !== this) {
        if (node._parent) {
          node._parent.removeChildren(node);
        }
        node._parent = this;
      }
    }
  }

  removeChildren(nodes) {
    if (!nodes) {
      return;
    }
    if (!Array.isArray(nodes)) {
      nodes = [nodes];
    } else if (nodes.length > 0) {
      nodes = nodes.slice();
    } else {
      return;
    }

    for (let node of nodes) {
      let index;
      do {
        index = this._children.indexOf(node);
        if (index >= 0) {
          this._children.splice(index, 1);
        }
      } while (index >= 0);
      if (node._parent === this) {
        node._parent = null;
      }
    }
  }


  insertChildren(index, nodes) {
    if (!nodes) {
      return;
    }
    if (!Array.isArray(nodes)) {
      nodes = [nodes];
    } else if (nodes.length > 0) {
      nodes = nodes.slice();
    } else {
      return;
    }

    this.addChildren(nodes);
    for (let iii = 0; iii < nodes.length; iii++) {
      let node = nodes[iii];
      let first = true;
      while (true) {
        let index = this._children.indexOf(node);
        if (index >= 0) {
          this._children.splice(index, 1);
        } else {
          break;
        }
        first = false;
      }
      if (first) {
        nodes.splice(iii, 1);
        iii--;
      }
    }
    if (index < 0) {
      index = 0;
    }
    if (index >= this._children.length) {
      this._children.push(...nodes);
    } else {
      this._children.splice(index, 0, ...nodes);
    }
  }


  get children() {
    return this._children.slice();
  }

  get parent() {
    return this._parent;
  }
  set parent(value) {
    if (value === this.parent) {
      return;
    }
    if (value) {
      value.addChildren(this);
    } else if (this.parent) {
      this.parent.removeChildren(this);
    } else {
      this._parent = null;
    }
  }

  // #endregion Node Relationships


  // #region Instances

  addInstance(type, id, instance) {
    let idInstanceLookup = {};
    idInstanceLookup[id] = instance;
    let obj = {};
    obj[type] = idInstanceLookup;
    this.addInstances(obj);
  }

  removeInstance(type, id) {
    let instances = {};
    instances[type] = [id];
    this.removeInstances(instances);
  }


  addInstances(instances) {
    if (!instances) {
      return;
    }
    let allowedKeys = Object.values(TreeInfoNode.instanceTypes);
    for (let [key, value] of Object.entries(instances)) {
      if (!value || !allowedKeys.includes(key)) {
        continue;
      }
      if (!this._instances[key]) {
        this._instances[key] = {};
      }
      Object.assign(this._instances[key], value);
    }
  }

  removeInstances(instances) {
    if (!instances) {
      return;
    }
    for (let [key, value] of Object.entries(instances)) {
      if (!value || !this._instances[key]) {
        continue;
      }
      let instanceTypeIdValueLookup = this._instances[key];
      let idsToRemove = Array.isArray(value) ? value : Object.keys(value);

      for (let id of idsToRemove) {
        delete instanceTypeIdValueLookup[id];
      }

      if (Object.keys(instanceTypeIdValueLookup).length === 0) {
        delete this._instances[key];
      }
    }
  }

  get instances() {
    return this._instances;
  }


  checkInstanceId(idType, id) {
    let typeLookup = this._instances[idType];
    return Boolean(typeLookup && typeLookup[id]);
  }

  getNodeById(idType, id) {
    let nodes = this.children.slice();
    while (nodes.length > 0) {
      let node = nodes.shift();
      if (node.checkInstanceId(idType, id)) {
        return node;
      }
      nodes.push(...node.children);
    }
    return null;
  }

  // #endregion Instances




  get title() {
    return this._title;
  }
  set title(value) {
    this._title = value;
  }

  get url() {
    return this._url;
  }
  set url(value) {
    this._url = value;
  }



  // #region Node manipulations

  prune({ parentNodes = [], maxTreeDepth = false, removeNodes = [] } = {}) {

    let hasMaxTreeDepth = (maxTreeDepth || maxTreeDepth === 0) && (maxTreeDepth === true || maxTreeDepth >= 0);

    if (!hasMaxTreeDepth && removeNodes.length === 0) {
      return this;
    }

    removeNodes = removeNodes.slice();
    parentNodes = parentNodes.slice();


    let parentLookup = new Map();

    let nodesToTest = [this];
    let allowedNodes = [this];

    while (nodesToTest.length > 0) {
      let parentNode = nodesToTest.shift();
      let parents = parentLookup.get(parentNode) || [];

      let removed = false;
      if (parentNode !== this && removeNodes.includes(parentNode)) {
        while (true) {
          let index = allowedNodes.indexOf(parentNode);
          if (index >= 0) {
            allowedNodes.splice(index, 1);
          } else {
            break;
          }
        }
        if (parentNode.parent) {
          parentNode.parent.removeChildren(parentNode);
        }
        removed = true;
      }


      if (parentNodes.includes(parentNode)) {
        if (!removed && !allowedNodes.includes(parentNode)) {
          let possibleParents = parents.slice();
          while (possibleParents.length > 0) {
            let possibleParent = possibleParents.pop();
            if (allowedNodes.includes(possibleParent)) {
              possibleParent.addChildren(parentNode);
              break;
            }
          }
          allowedNodes.push(parentNode);
        }
        parents = [];
      }


      if (parentNode.children.length === 0) {
        continue;
      }
      nodesToTest.splice(0, 0, ...parentNode.children);


      let childParents = parents.slice();
      childParents.push(parentNode);
      for (let childNode of parentNode.children) {
        parentLookup.set(childNode, childParents);
      }


      let skipChildren = hasMaxTreeDepth && (maxTreeDepth === true || parents.length >= maxTreeDepth);
      if (skipChildren) {
        parentNode.removeChildren(parentNode.children);
      } else {
        allowedNodes.push(...parentNode.children);
      }
    }

    return this;
  }


  async convertGroupURL(useLegacyURL, recursive = true) {
    let groupInfo = getGroupTabInfo(this.url);
    if (groupInfo) {
      this.url = (useLegacyURL ?
        kTST_LegacyGroupURL + groupInfo.urlArguments :
        getGroupTabURL({ internalId: await getInternalTSTId(), urlArguments: groupInfo.urlArguments })
      );
    }
    if (recursive) {
      return Promise.all(this.children.map(node => node.convertGroupURL(useLegacyURL, recursive)));
    }
  }

  // #endregion Node manipulations


  // #region Node meta info

  getNthContentNode(skipCount = 0) {
    let nodes = this.children.slice();
    while (nodes.length > 0) {
      let node = nodes.shift();
      if (node.url) {
        if (skipCount <= 0) {
          return node;
        }
        skipCount--;
      }
      nodes.splice(0, 0, ...node.children);
    }
    return null;
  }


  get descendants() {
    let nodes = this.children.slice();
    for (let iii = 0; iii < nodes.length; iii++) {
      let node = nodes[iii];
      nodes.push(...node.children);
    }
    return nodes;
  }

  get rootNode() {
    let node = this;
    while (node.parent) {
      node = node.parent;
    }
    return node;
  }

  get count() {
    return this.descendants.filter(node => node.url).length + (this.url ? 1 : 0);
  }

  get firstContentNode() {
    return this.getNthContentNode(0);
  }

  get hasContent() {
    return Boolean(this.firstContentNode);
  }

  // #endregion Node meta info


  async openAsTabs({
    handleParentId = null,
    handleParentLast = false,
    parentTabId = null,
    windowId = null,
    delayAfterTabOpen = () => -1,
    navigationOfOpenedTabDelay = () => -1,
    detachIncorrectParentAfterDelay = () => -1,
    checkAllowedParent = null,
    allowNonCreatedParent = false,
    createTempTab = false,
    tempTabURL = '',
    groupUnderTempTab = false,
    focusPreviousTab = false,
    dontFocusOnNewTabs = false,
  } = {}) {

    let previousActiveTab = null;
    if (focusPreviousTab) {
      let previousDetails = {
        active: true,
      };
      if (windowId || windowId === 0) {
        previousDetails.windowId = windowId;
      } else {
        previousDetails.currentWindow = true;
      }

      previousActiveTab = await browser.tabs.query(previousDetails);
      windowId = previousActiveTab.windowId;
    }


    let tempTab = null;
    if (createTempTab) {
      let details = { active: true };
      if (tempTabURL) {
        details.url = tempTabURL;
      }
      if (parentTabId || parentTabId === 0) {
        details.parentTabId = parentTabId;
      }
      tempTab = await browser.tabs.create(details);
      await trackedDelay(delayAfterTabOpen());
    }

    if (tempTab && groupUnderTempTab) {
      parentTabId = tempTab.id;
    }


    let tabs = [];


    // #region Fix incorrect relationship between created tabs

    if (!checkAllowedParent && allowNonCreatedParent) {
      checkAllowedParent = async (tab) => {
        let tstTab = await getTSTTabs(tab.id);
        let { ancestorTabIds } = tstTab;
        for (let ancestorTabId of ancestorTabIds) {
          if (tabs.some(aTab => aTab.id === ancestorTabId.id)) {
            return false;
          }
        }
        return true;
      };
    }

    // #endregion Fix incorrect relationship between created tabs


    // #region Set tree info after tab create

    let callbacks = null;
    if (!handleParentId && handleParentLast) {
      callbacks = [];
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

    // #endregion Set tree info after tab create


    // #region Create Tab

    let tab;
    try {

      if (this.url) {

        // #region Create Details

        let createDetails = { url: this.url };

        let navigationDelay = navigationOfOpenedTabDelay();
        let navigationURL = null;
        if (createDetails.url.toLowerCase() === 'about:newtab') {
          delete createDetails.url;
        } else if (navigationDelay >= 0) {
          navigationURL = createDetails.url;
          createDetails.url = 'about:blank';
        }





        if (dontFocusOnNewTabs) {
          createDetails.active = false;
        }

        if (parentTabId && !handleParentId) {
          createDetails.openerTabId = parentTabId;
        }
        if (windowId || windowId === 0) {
          createDetails.windowId = windowId;
        }

        // #endregion Create Details


        // #region Create Tab

        try {
          tab = await browser.tabs.create(createDetails);
        } catch (error) {
          let lastURL = createDetails.url;
          createDetails.url = `about:blank?${lastURL}`;
          console.log(`Failed to open "${lastURL}" open "${createDetails.url}" instead.`);
          tab = await browser.tabs.create(createDetails);
        }
        tabs.push(tab);

        // #endregion Create Tab


        if (navigationURL) {
          trackedDelay(navigationDelay).finally(async () => {
            try {
              await browser.tabs.update(tab.id, { url: navigationURL });
            } catch (error) {
              let lastURL = navigationURL;
              let newURL = `about:blank?${lastURL}`;
              console.log(`Failed to open "${lastURL}" open "${newURL}" instead.`);
              await browser.tabs.update(tab.id, { url: newURL });
            }
          });
        }


        await trackedDelay(delayAfterTabOpen());

        if (parentTabId && handleParentId) {
          handleParentId(tab, parentTabId);
        }
        let shouldDetach = detachIncorrectParentAfterDelay();
        if (!parentTabId && ((shouldDetach || shouldDetach === 0) && (shouldDetach === true || shouldDetach >= 0))) {
          let detach = async () => {
            if (checkAllowedParent) {
              if (await checkAllowedParent(tab)) {
                return;
              }
            }
            await browser.runtime.sendMessage(kTST_ID, {
              type: 'detach',
              tab: tab.id,
            });
          };
          if (shouldDetach === true) {
            detach();
          } else {
            trackedDelay(shouldDetach).finally(() => {
              detach();
            });
          }
        }
      }

    } catch (error) {
      console.log('Failed to create tab!\n', error);
    }

    // #endregion Create Tab


    // #region Create Child Tabs

    for (let node of this.children) {
      let childTabs = await node.openAsTabs({
        handleParentId,
        handleParentLast: false,
        parentTabId: (tab || {}).id || parentTabId,
        windowId: (tab || {}).windowId || windowId,
        delayAfterTabOpen,
        navigationOfOpenedTabDelay,
        detachIncorrectParentAfterDelay,
        checkAllowedParent,
        allowNonCreatedParent: false,
        createTempTab: false,
        tempTabURL,
        groupUnderTempTab: false,
        focusPreviousTab,
        dontFocusOnNewTabs,
      });
      tabs.push(...childTabs);
    }

    // #endregion Create Child Tabs


    if (callbacks) {
      for (let callback of callbacks) {
        await callback();
      }
    }


    try {
      if (focusPreviousTab && previousActiveTab) {
        await browser.tabs.update(previousActiveTab.id, { active: true });
      } else if (tabs.length > 0) {
        await browser.tabs.update(tabs[0].id, { active: true });
      }
    } catch (error) { }



    if (tempTab) {
      if (groupUnderTempTab) {
        for (let tab of tabs) {
          if (tab.openerTabId !== tempTab.id) {
            continue;
          }
          try {
            await browser.runtime.sendMessage(kTST_ID, {
              type: 'detach',
              tab: tab.id,
            });
          } catch (error) { }
        }

        await trackedDelay(delayAfterTabOpen());
      }

      try {
        await browser.tabs.remove(tempTab.id);
      } catch (error) { }
    }

    return tabs;
  }


  async saveAsBookmarks({ parentBookmarkId, useSeparators = false, useSeparatorsForChildren = true, folderSuffix = '', recursive = true } = {}) {
    let bookmarkDetails = {};
    if (parentBookmarkId) {
      bookmarkDetails.parentId = parentBookmarkId;
    }

    if (this.children.length === 0 || (!recursive && this.url)) {
      if (!this.url) {
        return null;
      }
      let details = Object.assign({ title: this.title, url: this.url }, bookmarkDetails);
      return browser.bookmarks.create(details);
    }

    if (!this.url && this.children.length === 1) {
      return this.children[0].saveAsBookmarks(arguments[0]);
    }


    let folderBookmark;
    let bookmarks = [];
    if (!useSeparators) {
      let folderTitle = this.title;
      if (!this.url) {
        let firstURLNode = this.firstContentNode;
        if (!firstURLNode) {
          return null;
        }
        folderTitle = firstURLNode.title;
      }

      if (!this.url && this.children.length > 1) {
        folderTitle = browser.i18n.getMessage('bookmark_MultipleTabsTitle', folderTitle);
      }
      folderTitle += folderSuffix;

      folderBookmark = await browser.bookmarks.create(Object.assign({
        title: folderTitle,
      }, bookmarkDetails));

      parentBookmarkId = folderBookmark.id;

      if (this.url) {
        let separator = await browser.bookmarks.create({
          type: 'separator',
          parentId: parentBookmarkId,
        });
      }
    } else if (this.url) {
      let separator = await browser.bookmarks.create(Object.assign({
        type: 'separator',
      }, bookmarkDetails));
    }

    let callInfo = {
      parentBookmarkId,
      useSeparators: useSeparatorsForChildren,
      useSeparatorsForChildren,
      folderSuffix,
      recursive,
    };

    if (this.url) {
      let parentBookmark = await this.saveAsBookmarks(Object.assign({}, callInfo, { recursive: false }));
      bookmarks.push(parentBookmark);
    }
    for (let item of this.children) {
      let childBookmarks = await item.saveAsBookmarks(callInfo);
      bookmarks.push(childBookmarks);
    }

    if (folderBookmark) {
      return folderBookmark;
    } else if (this.url) {
      for (let iii = 0; iii < 2; iii++) {
        let separator = await browser.bookmarks.create(Object.assign({
          type: 'separator',
        }, bookmarkDetails));
      }
    }
    return bookmarks;
  }


  // #region Static

  static async createFromTabs(parentTabs, { isTSTTab = false } = {}) {

    // #region Argument checks

    if (!parentTabs) {
      return null;
    }
    let single = false;
    if (!Array.isArray(parentTabs)) {
      parentTabs = [parentTabs];
      single = true;
    }
    if (parentTabs.length === 0) {
      return [];
    }
    let tstTabs = isTSTTab ? parentTabs : await getTSTTabs(parentTabs.map(tab => tab.id));

    // #endregion Argument checks


    // #region Create Nodes

    let nodeLookup = {};
    let tabLookup = {};
    let tabs = tstTabs.slice();
    while (tabs.length > 0) {
      let tab = tabs.shift();
      if (!tabLookup[tab.id]) {
        tabLookup[tab.id] = tab;
      }
      if (!nodeLookup[tab.id]) {
        let node = new TreeInfoNode({ title: tab.title, url: tab.url });
        node.addInstance(TreeInfoNode.instanceTypes.tab, tab.id, tab);
        nodeLookup[tab.id] = node;
        tabs.push(...tab.children);
      }
    }

    // #endregion Create Nodes


    // #region Set relationships

    for (let tabId of Object.keys(nodeLookup)) {
      nodeLookup[tabId].addChildren(tabLookup[tabId].children.map(tab => nodeLookup[tab.id]));
    }

    // #endregion Set relationships


    let result = tstTabs.map(tab => nodeLookup[tab.id]);


    // #region Make root node if needed

    let rootResultNodes = [];
    for (let node of result) {
      let rootNode = node.rootNode;
      if (!rootResultNodes.includes(rootNode)) {
        rootResultNodes.push(rootNode);
      }
    }
    if (rootResultNodes.length > 1) {
      new TreeInfoNode({ children: rootResultNodes });
    }

    // #endregion Make root node if needed


    if (result.length === 1 && single) {
      return result[0];
    } else {
      return result;
    }
  }


  static async parseFromBookmarks({ bookmarkId, rootBookmark, supportSeparators = true } = {}) {
    if (bookmarkId && (!rootBookmark || rootBookmark.id !== bookmarkId)) {
      rootBookmark = (await browser.bookmarks.getSubTree(bookmarkId))[0];
    }
    if (!rootBookmark) {
      return null;
    }


    let createdNode = null;
    switch (rootBookmark.type) {
      case 'bookmark': {
        createdNode = new TreeInfoNode({ title: rootBookmark.title, url: rootBookmark.url });
      } break;

      case 'folder': {
        let first = false;
        let isParent = false;
        let separators = [];
        let startSeparator = null;

        createdNode = new TreeInfoNode({ title: rootBookmark.title });
        let parentNodes = [];
        let parentNode = createdNode;

        for (let bookmark of rootBookmark.children) {
          if (bookmark.type === 'separator') {
            if (first) {
              isParent = true;
            }
            if (supportSeparators) {
              separators.push(bookmark);
            }
            continue;
          }
          if (separators.length > 0) {
            while (separators.length >= 2 && parentNodes.length > 0) {
              let endSeparators = [separators.shift(), separators.shift()];
              if (parentNode) {
                for (let separator of endSeparators) {
                  parentNode.addInstance(TreeInfoNode.instanceTypes.bookmark, separator.id, separator);
                }
              }
              parentNode = parentNodes.pop();
            }
            if (separators.length % 2 === 1 && (parentNodes.length === 0 || parentNodes[parentNodes.length - 1] !== parentNode)) {
              parentNodes.push(parentNode);
              isParent = true;
              startSeparator = separators[0];
            }
            separators = [];
          }

          let parsedNode = await TreeInfoNode.parseFromBookmarks({ rootBookmark: bookmark, supportSeparators });

          if (parsedNode) {
            if (isParent) {
              parentNode.addChildren(parsedNode);
              parentNode = parsedNode;
              isParent = false;
              if (startSeparator) {
                parentNode.addInstance(TreeInfoNode.instanceTypes.bookmark, startSeparator.id, startSeparator);
                startSeparator = null;
              }
            } else {
              if (!parsedNode.url) {
                parentNode.addChildren(parsedNode.children);
              } else {
                parentNode.addChildren(parsedNode);
              }
            }
          }

          if (first) {
            first = false;
          }
        }
      } break;

      case 'separator': {

      } break;
    }
    if (createdNode) {
      createdNode.addInstance(TreeInfoNode.instanceTypes.bookmark, rootBookmark.id, rootBookmark);
    }
    return createdNode;
  }

  // #endregion Static

}
TreeInfoNode.instanceTypes = Object.freeze({
  bookmark: 'bookmark',
  tab: 'tab',
});

/**
 * 
 * 
 * @param {Object|Array} parentTabs Parent tab(s) to bookmark together with their children tabs.
 * @param {boolean} [isTSTTab = false] The provided tabs have Tree Style Tab data.
 * @param {boolean} [parentBookmarkId = null] The id of the bookmark folder to use when bookmarking the tabs.
 * @param {boolean} [useSeparators = false] Use separators instead of folders when possible.
 * @param {boolean} [useSeparatorsForChildren = false] Use separators instead of folders when bookmarking sub trees.
 * @param {boolean} [useLegacyGroupTabURL = false] Convert Tree Style Tab's group tab URLs to use the legacy URL that is independant of Tree Style Tab's internal id.
 * @param {boolean} [maxTreeDepth = false] The number of child levels from the provided parent tabs to include.
 * @param {boolean} [maxTotalTreeDepth = false] The number of child levels from root tab to include.
 * @param {boolean} [warnWhenMoreThan = -1] If the number of tabs that should be bookmarked is greater than this amount then confirm with the user that they want to continue. False or negative to disable.
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
  ensureOneParent = false
} = {}) {

  let clickedBookmark = (await browser.bookmarks.getSubTree(bookmarkId))[0];
  let rootBookmark = clickedBookmark;
  if (rootBookmark.type !== 'folder') {
    rootBookmark = (await browser.bookmarks.getSubTree(rootBookmark.parentId))[0];
  }

  let treeNodes = await TreeInfoNode.parseFromBookmarks({ rootBookmark, supportSeparators });
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
  });
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

    success = await createMTHContextMenuItem('mth-bookmark-tree', settings.customMTHContextMenuLabel || browser.i18n.getMessage('contextMenu_TreeStyleTabAndMTH'));
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


settingsLoaded.finally(async () => {

  // #region Browser Version

  let browserInfo = {};
  let majorBrowserVersion = 57;
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
    return {
      handleParentLast: settings.setParentAfterTabCreate,

      delayAfterTabOpen: () => settings.delayAfterTabOpen,
      navigationOfOpenedTabDelay: () => settings.delayBeforeNavigating,
      detachIncorrectParentAfterDelay: () => settings.detachIncorrectParentsAfter,

      createTempTab: settings.createTempTabWhenRestoring,
      tempTabURL: settings.tempTabURL,
      groupUnderTempTab: settings.gruopUnderTempTabWhenRestoring,
      ensureOneParent: settings.ensureOneParentWhenCreatingTabs,

      supportSeparators: settings.allowSeparatorsWhenRestoringTree,
      fixGroupTabURLs: settings.fixGroupTabURLsOnRestore,
      warnWhenMoreThan: settings.warnWhenRestoringMoreThan,
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
  };

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
      // Attempt to get multiselected tabs from the WebExtensions API:
      tabs = await browser.tabs.query(details);
    } catch (error) { }

    // Fallback to MTH Query:
    if (majorBrowserVersion < 64 && tabs.length <= 1) {
      try {
        // Attempt to get multiselected tabs from Multiple Tab Handler:
        var selectionInfo = await browser.runtime.sendMessage(kMTH_ID, {
          type: 'get-tab-selection'
        });
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

  // #endregion Tree Stlye Tab


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

});
