'use strict';

import {
    kTST_ID,
    getTSTTabs,
} from '../tree-style-tab/utilities.js';

import {
    getGroupTabInfo,
    getGroupTabURL,
} from '../tree-style-tab/group-tab.js';

import {
    getInternalTSTId,
} from '../tree-style-tab/internal-id.js';

import {
    trackedDelay,
} from '../common/common.js';

/**
 * A bookmark object returned by the WebExtension API.
 * 
 * An object of type `bookmarks.BookmarkTreeNode` represents a node in the bookmark tree, where each node is a bookmark, a bookmark folder, or a separator. Child nodes are ordered by an index within their respective parent folders.
 * 
 * @typedef {Object} BookmarkTreeNode
 * @property {BookmarkTreeNode[]} [children] An array of `bookmarks.BookmarkTreeNode` objects which represent the node's children. The list is ordered in the list in which the children appear in the user interface. This field is omitted if the node isn't a folder.
 * @property {number} [dateAdded] A number representing the creation date of the node in milliseconds since the epoch.
 * @property {number} [dateGroupModified] A number representing the date and time the contents of this folder last changed, in milliseconds since the epoch.
 * @property {string} id A string which uniquely identifies the node. Each ID is unique within the user's profile and remains unchanged across browser restarts.
 * @property {number} [index] A number which represents the zero-based position of this node within its parent folder, where zero represents the first entry.
 * @property {string} [parentId] A string which specifies the ID of the parent folder. This property is not present in the root node.
 * @property {string} title A string which contains the text displayed for the node in menus and lists of bookmarks.
 * @property {BookmarkTreeNodeType} [type] A bookmarks.BookmarkTreeNodeType object indicating whether this is a bookmark, a folder, or a separator. Defaults to "bookmark" unless url is omitted, in which case it defaults to "folder".
 * @property {BookmarkTreeNodeUnmodifiable} [unmodifiable] A string as described by the type `bookmarks.BookmarkTreeNodeUnmodifiable`. Represents the reason that the node can't be changed. If the node can be changed, this is omitted.
 * @property {string} [url] A string which represents the URL for the bookmark. If the node represents a folder, this property is omitted. 
 */
null;

/**
 * The `bookmarks.BookmarkTreeNodeUnmodifiable` type is used to indicate the reason that a node in the bookmark tree (where each node is either a bookmark or a bookmark folder) cannot be changed. This is used as the value of the `bookmarks.BookmarkTreeNode.unmodifiable.unmodifiable` field on bookmark nodes.
 * 
 * # Type
 * 
 * `bookmarks.BookmarkTreeNodeUnmodifiable` is a `string` which can currently have only one value: `"managed"`. This indicates that the bookmark node was configured by an administrator or by the custodian of a supervised user (such as a parent, in the case of parental controls).
 * 
 * @typedef {'managed'} BookmarkTreeNodeUnmodifiable
 */
null;

/**
 * The `bookmarks.BookmarkTreeNodeType` type is used to describe whether a node in the bookmark tree is a bookmark, a folder, or a separator.
 * 
 * # Type
 * 
 * `bookmarks.BookmarkTreeNodeType` is a `string` which can have one of the following three values:
 * 
 * - `"bookmark"`: the node is a bookmark.
 * - `"folder"`: the node is a folder.
 * - `"separator"`: the node is a separator.
 *
 * @typedef {'bookmark' | 'folder' | 'separator'} BookmarkTreeNodeType
 */
null;


export class TreeInfoNode {

    /**
     * Creates an instance of TreeInfoNode.
     * 
     * @param {Object} Params Parameters
     * @param {string} Params.title The title of this node. This represents a tab's title or a bookmark's title.
     * @param {string | null} Params.url The URL of this node. If `null` or empty then considered to be a folder.
     * @param {TreeInfoNode[]} Params.children Child nodes of this node. If this node has a URL then the children will be child tabs of the current node's tab. Parent properties will be automatically updated.
     * @param {TreeInfoNode | null} Params.parent The parent node of this node.
     * @param {Object} Params.instances Instances where this node exists. This can be tab ids or bookmark ids. These will be used with the `addInstances` method.
     * @memberof TreeInfoNode
     */
    constructor({ title, url = null, children = [], parent = null, instances = {} } = {}) {
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
            // eslint-disable-next-line no-underscore-dangle
            if (node._parent !== this) {
                // eslint-disable-next-line no-underscore-dangle
                if (node._parent) {
                    // eslint-disable-next-line no-underscore-dangle
                    node._parent.removeChildren(node);
                }
                // eslint-disable-next-line no-underscore-dangle
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
            // eslint-disable-next-line no-underscore-dangle
            if (node._parent === this) {
                // eslint-disable-next-line no-underscore-dangle
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

    /**
     * Remove some child nodes while preserving parent-child relationships as much as possible.
     *
     * @param {Object} Params Parameters
     * @param {TreeInfoNode[]} [Params.parentNodes] Nodes that should also be considered parent nodes.
     * @param {boolean | number} [Params.maxTreeDepth] If `true` only include parent nodes. If a `number` then only include a node if it is only that many levels deeper than a specified parent node.
     * @param {TreeInfoNode[]} [Params.removeNodes] Specific nodes that should be removed.
     * @returns {TreeInfoNode} This node.
     * @memberof TreeInfoNode
     */
    prune({ parentNodes = [], maxTreeDepth = false, removeNodes = [] } = {}) {

        const hasMaxTreeDepth = (maxTreeDepth || maxTreeDepth === 0) && (maxTreeDepth === true || maxTreeDepth >= 0);

        if (!hasMaxTreeDepth && removeNodes.length === 0) {
            return this;
        }

        removeNodes = removeNodes.slice();
        parentNodes = parentNodes.slice();


        const parentLookup = new Map();

        const nodesToTest = [this];
        const allowedNodes = [this];

        while (nodesToTest.length > 0) {
            const parentNode = nodesToTest.shift();
            let parents = parentLookup.get(parentNode) || [];

            let removed = false;
            if (parentNode !== this && removeNodes.includes(parentNode)) {
                while (true) {
                    const index = allowedNodes.indexOf(parentNode);
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
                    const possibleParents = parents.slice();
                    while (possibleParents.length > 0) {
                        const possibleParent = possibleParents.pop();
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


            const childParents = parents.slice();
            childParents.push(parentNode);
            for (const childNode of parentNode.children) {
                parentLookup.set(childNode, childParents);
            }


            const skipChildren = hasMaxTreeDepth && (maxTreeDepth === true || parents.length >= maxTreeDepth);
            if (skipChildren) {
                parentNode.removeChildren(parentNode.children);
            } else {
                allowedNodes.push(...parentNode.children);
            }
        }

        return this;
    }


    async convertGroupURL({ useLegacyURL, newFallbackURL = false, recursive = true } = {}) {
        const groupInfo = getGroupTabInfo(this.url);
        if (groupInfo) {
            this.url = getGroupTabURL({ internalId: (useLegacyURL ? null : await getInternalTSTId()), urlArguments: groupInfo.urlArguments, newFallbackURL });
        }
        if (recursive) {
            const params = arguments[0];
            return Promise.all(this.children.map(node => node.convertGroupURL(params)));
        }
    }

    // #endregion Node manipulations


    // #region Node meta info


    /**
     * Get the nth child node that has a URL. Child nodes are processed directly after their parent node.
     *
     * @param {number} [skipCount=0] Number of nodes with URLs ordered before the returned node.
     * @returns {null|TreeInfoNode} A node with a URL.
     * @memberof TreeInfoNode
     */
    getNthContentNode(skipCount = 0) {
        const nodes = this.children.slice();
        while (nodes.length > 0) {
            const node = nodes.shift();
            if (node.url) {
                // Found content node!
                if (skipCount <= 0) {
                    return node;
                }
                // Skipping this content node:
                skipCount--;
            }
            // Insert all child nodes at the beginning of the queue:
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

    /**
     * The total number of content nodes. Includes children and the current node.
     *
     * @readonly
     * @memberof TreeInfoNode
     */
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
        openAsDiscardedTabs = false,
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



                if (openAsDiscardedTabs && createDetails.url && !createDetails.url.toLowerCase().startsWith('about:')) {
                    createDetails.discarded = true;
                    createDetails.title = this.title;
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
                    if (createDetails.discarded) {
                        delete createDetails.discarded;
                        delete createDetails.title;
                    }
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
            const childTabs = await node.openAsTabs(
                Object.assign({}, arguments[0], {
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
                }));
            tabs.push(...childTabs);
        }

        // #endregion Create Child Tabs


        if (callbacks) {
            for (let callback of callbacks) {
                await callback();
            }
        }


        if (!dontFocusOnNewTabs) {
            try {
                if (focusPreviousTab && previousActiveTab) {
                    await browser.tabs.update(previousActiveTab.id, { active: true });
                } else if (tabs.length > 0) {
                    await browser.tabs.update(tabs[0].id, { active: true });
                }
            } catch (error) { }
        }



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


    /**
     * Save tree data as bookmarks.
     *
     * @param {Object} Params Parameters.
     * @param {string | null} Params.parentBookmarkId The id of the bookmark folder that the node should be saved to.
     * @param {string} Params.format A format that specifies how the bookmarks store tree information.
     * @param {string} [Params.folderSuffix=''] If a folder is created then it will have this suffix.
     * @param {string | null} [Params.folderTitle=null] Specify the created folders exact title. The `folderSuffix` won't be added to this title.
     * @param {boolean} [Params.inFolder=false] If at least one bookmark is created then ensure that all new bookmarks is placed in a new folder.
     * @param {boolean} [Params.recursive=true] Create bookmarks for child nodes as well as this node.
     * @param {number} [Params.parentCount=0] The number of parent nodes that the current node has.
     * @returns {BookmarkTreeNode[]} Array of object with info about the bookmarks that were created directly in the specified bookmark folder.
     * @memberof TreeInfoNode
     */
    async saveAsBookmarks({ parentBookmarkId, format, folderSuffix = '', folderTitle = null, inFolder = false, recursive = true, parentCount = 0 } = {}) {
        const bookmarkDetails = {};
        if (parentBookmarkId) {
            bookmarkDetails.parentId = parentBookmarkId;
        }

        if (!inFolder && (this.children.length === 0 || !recursive)) {
            // Create a bookmark only for this node's tab.
            if (!this.url) return [];
            let title = this.title;
            if (format === TreeInfoNode.bookmarkFormat.titles) {
                if (parentCount > 0) {
                    title = '>'.repeat(parentCount) + ' ' + title;
                } else {
                    // Check so that the title doesn't already start with something that will be interpreted as tree data.
                    while (true) {
                        let removeTo = 0;
                        for (let iii = 0; iii < title.length; iii++) {
                            const c = title[iii];
                            if (c === '>') continue;
                            if (c === ' ') removeTo = iii;    // Found valid tree data prefix => remove it so that its not parsed as tree data when restoring tabs.
                            break;
                        }
                        if (removeTo > 0)
                            // Remove tree data prefix and recheck the new title:
                            title = title.slice(removeTo + 1);
                        else
                            // Title doesn't start with valid tree data so its okay to use:
                            break;
                    }
                }
            }
            return [await browser.bookmarks.create(Object.assign({ title, url: this.url }, bookmarkDetails))];
        }
        if (!this.url && this.children.length === 1) {
            // If this node is a folder with a single child node then forward the call to the child node.
            return this.children[0].saveAsBookmarks(arguments[0]);
        }

        const bookmarks = [];
        const getCallInfo = () => ({
            parentBookmarkId,
            folderSuffix,
            format,
            recursive,
            parentCount,
        });
        const createBookmarks = async () => {
            const callInfo = getCallInfo();

            if (this.url) {
                const parentBookmark = await this.saveAsBookmarks(Object.assign({}, callInfo, { recursive: false }));
                parentBookmark.forEach(b => { bookmarks.push(b); });
                callInfo.parentCount += 1;
            }
            for (const item of this.children) {
                const childBookmarks = await item.saveAsBookmarks(callInfo);
                childBookmarks.forEach(b => { bookmarks.push(b); });
            }
        };

        if (format === TreeInfoNode.bookmarkFormat.folders || inFolder) {
            if (!folderTitle && folderTitle !== '') {
                // Use first tab's title for folder title:
                folderTitle = this.title;
                if (!this.url) {
                    const firstURLNode = this.firstContentNode;
                    if (!firstURLNode) {
                        return [];
                    }
                    folderTitle = firstURLNode.title;
                }
                if (!this.url && this.children.length > 1) {
                    // If folder with more then one tab then append " and more" or equivalent to title.
                    folderTitle = browser.i18n.getMessage('bookmark_MultipleTabsTitle', folderTitle);
                }
                folderTitle += folderSuffix;
            }

            // Create bookmark folder:
            const folderBookmark = await browser.bookmarks.create(Object.assign({
                title: folderTitle,
            }, bookmarkDetails));

            parentBookmarkId = folderBookmark.id;
            if (format === TreeInfoNode.bookmarkFormat.folders) {
                if (this.url) {
                    // This is a parent tab => Create separator for compatibility with separator format:
                    const separator = await browser.bookmarks.create({
                        type: 'separator',
                        parentId: parentBookmarkId,
                    });
                    bookmarks.push(separator);
                } else {
                    // This isn't a parent tab => Create an empty folder at the start of the current folder to indicate that all tabs are at the same level:
                    const topLevelIndicator = await browser.bookmarks.create({
                        type: 'folder',
                        parentId: parentBookmarkId,
                    });
                    bookmarks.push(topLevelIndicator);
                }

                await createBookmarks();
            } else {
                // Folder has been created now save the node as it would normally be saved:
                await this.saveAsBookmarks(getCallInfo());
            }

            return [folderBookmark];
        } else if (format === TreeInfoNode.bookmarkFormat.separators) {
            if (this.url) {
                const separator = await browser.bookmarks.create(Object.assign({
                    type: 'separator',
                }, bookmarkDetails));
                bookmarks.push(separator);
            }

            await createBookmarks();

            if (this.url) {
                for (let iii = 0; iii < 2; iii++) {
                    const separator = await browser.bookmarks.create(Object.assign({
                        type: 'separator',
                    }, bookmarkDetails));
                    bookmarks.push(separator);
                }
            }
        } else if (format === TreeInfoNode.bookmarkFormat.titles) {
            await createBookmarks();
        } else
            throw new Error(`Unsupported bookmark tree structure format: ${format}`);

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
        const tstTabs = isTSTTab ? parentTabs : await getTSTTabs(parentTabs.map(tab => tab.id));

        // #endregion Argument checks


        // #region Create Nodes

        const nodeLookup = {};
        const tabLookup = {};
        const tabs = tstTabs.slice();
        while (tabs.length > 0) {
            const tab = tabs.shift();
            if (!tabLookup[tab.id]) {
                tabLookup[tab.id] = tab;
            }
            if (!nodeLookup[tab.id]) {
                const hasTSTUrlPermission = 'url' in tab && 'title' in tab;
                if (!hasTSTUrlPermission) {
                    // Get tab from Firefox:
                    const firefoxTab = await browser.tabs.get(tab.id);
                    // Updated tab object:
                    Object.assign(tab, firefoxTab);
                }
                const node = new TreeInfoNode({ title: tab.title, url: tab.url });
                node.addInstance(TreeInfoNode.instanceTypes.tab, tab.id, tab);
                nodeLookup[tab.id] = node;
                tabs.push(...tab.children);
            }
        }

        // #endregion Create Nodes


        // #region Set relationships

        for (const tabId of Object.keys(nodeLookup)) {
            nodeLookup[tabId].addChildren(tabLookup[tabId].children.map(tab => nodeLookup[tab.id]));
        }

        // #endregion Set relationships


        const result = tstTabs.map(tab => nodeLookup[tab.id]).filter(node => node);


        // #region Make root node if needed

        const rootResultNodes = [];
        for (const node of result) {
            const rootNode = node.rootNode;
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

    /**
     * Parse tree structure from bookmarks. 
     *
     * @static
     * @param {Object} Params Parameters.
     * @param {string} Params.bookmarkId The id of the bookmark node that should be parsed.
     * @param {null | BookmarkTreeNode} [Params.rootBookmark] An object with data about the root bookmark.
     * @param {string} Params.format A format that specifies how the bookmarks store tree information.
     * @returns {null|TreeInfoNode} The parsed tree structure.
     * @memberof TreeInfoNode
     */
    static async parseFromBookmarks({ bookmarkId, rootBookmark, format } = {}) {
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
                let first = true;
                let folderFormat_parentFound = false;
                /** Indicates that the next bookmark that is parsed should be treated as a parent tab. */
                let isParent = false;
                let separators = [];
                let startSeparator = null;

                createdNode = new TreeInfoNode({ title: rootBookmark.title });
                /** @type {TreeInfoNode[]} Stored bookmark nodes that represent parent tabs for the `parentNode`. The length of this array is equal to the number of ancestors a bookmark's tab would have (plus one extra for the root level group/container). */
                const parentNodes = [];
                /** The bookmark node that represents the parent tab for the next parsed bookmark. */
                let parentNode = createdNode;

                for (const bookmark of rootBookmark.children) {
                    switch (format) {
                        case TreeInfoNode.bookmarkFormat.separators: {
                            if (bookmark.type === 'separator') {
                                separators.push(bookmark);
                                continue;
                            }
                            if (separators.length > 0) {
                                while (separators.length >= 2 && parentNodes.length > 0) {
                                    const endSeparators = [separators.shift(), separators.shift()];
                                    if (parentNode) {
                                        for (const separator of endSeparators) {
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
                        } break;

                        case TreeInfoNode.bookmarkFormat.folders: {
                            // The first bookmark in a folder represents a parent tab unless there was a folder before the first bookmark.
                            isParent = !folderFormat_parentFound && bookmark.type === 'bookmark';

                            if (bookmark.type === 'folder' || bookmark.type === 'bookmark') {
                                folderFormat_parentFound = true;
                            }
                        } break;

                        case TreeInfoNode.bookmarkFormat.titles: {
                            if (bookmark.type === 'folder') {
                                // Ignore folders since Tree Style Tab doesn't restore nested folders.
                                // Behavior in TST v3.2.1 is actually to open a new tab with tree level 0 where nested folders are found.
                                continue;
                            } else if (bookmark.type !== 'bookmark') {
                                // Must be a bookmark so that it has a title.
                                continue;
                            }
                            // Parse Wanted Tree Level from bookmark's title:
                            let treeLevel = 0;
                            for (let iii = 0; iii < bookmark.title.length; iii++) {
                                const c = bookmark.title[iii];
                                if (c === '>') continue;
                                if (c === ' ') treeLevel = iii;
                                break;
                            }
                            // Decrement Current Tree Level:
                            while (parentNodes.length - 1 > treeLevel) {
                                parentNode = parentNodes.pop();
                            }
                            // Increment Current Tree Level:
                            while (parentNodes.length - 1 < treeLevel) {
                                parentNodes.push(parentNode);
                            }
                            // Always store the parsed node in the `parentNode` variable since we don't know ahead of time if the bookmark will be a parent (that depends on the next bookmark):
                            isParent = true;
                            // Use the last saved parent as the parent for the parsed node:
                            parentNode = parentNodes[parentNodes.length - 1];
                        } break;

                        default:
                            throw new Error(`Unsupported bookmark tree structure format: ${format}`);
                    }

                    const parsedNode = await TreeInfoNode.parseFromBookmarks({ rootBookmark: bookmark, format });

                    if (parsedNode) {
                        if (!parsedNode.url) {
                            // Parsed node was a folder so just add the bookmarks that represent actual tabs as children to the current parent node.
                            parentNode.addChildren(parsedNode.children);
                        } else {
                            parentNode.addChildren(parsedNode);
                            if (isParent) {
                                parentNode = parsedNode;
                                isParent = false;
                                if (startSeparator) {
                                    parentNode.addInstance(TreeInfoNode.instanceTypes.bookmark, startSeparator.id, startSeparator);
                                    startSeparator = null;
                                }
                            }
                            if (format === TreeInfoNode.bookmarkFormat.titles && parentNodes.length > 1) {
                                // Remove title prefix that is used to store tree data.
                                parsedNode.title = parsedNode.title.slice(parentNodes.length);
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


    // #region Bookmark Format

    /**
     * Attempt to guess the bookmark format that was used to store tree information for bookmarks.
     *
     * @static
     * @param {Object} Params Parameters
     * @param {BookmarkTreeNode} Params.rootBookmark A folder bookmark that should contain bookmarks that were saved with tree data.
     * @param {null | string[]} [Params.allowedFormats=null] Formats that can be guessed. `null` to guess between all formats.
     * @returns {string} The bookmark format that was most likely used to save the tree data.
     * @memberof TreeInfoNode
     */
    static guessBookmarkFormat({ rootBookmark, allowedFormats = null }) {
        if (!allowedFormats || !Array.isArray(allowedFormats)) {
            allowedFormats = Object.values(TreeInfoNode.bookmarkFormat);
        }

        /** @type {Object<string, BookmarkFormatValidationInfo>} Key: format value. Value: format validation info. */
        const reports = {};
        for (const format of allowedFormats) {
            const validationReport = TreeInfoNode.validateBookmarkFormat({ rootBookmark, format });
            if (validationReport) {
                reports[format] = validationReport;
            }
        }
        console.log('Auto detect tree data format for bookmarks - validation reports: ', reports);

        const messageTypeMultipliers = {
            validated: 3,
            warnings: -1,
            errors: -15,
        };

        let maxScore = 0;
        let maxScoredFormat = null;

        for (const [format, report] of Object.entries(reports)) {
            const messageMultipliers = {};
            if (format !== TreeInfoNode.bookmarkFormat.titles) {
                // This message works best when each relationship requires something that indicates that the format is present.
                messageMultipliers.parentChildRelationship = 0;
            }


            let score = 0;

            for (const [messageType, messages] of Object.entries(report)) {
                const multiplier = messageTypeMultipliers[messageType];
                if (!multiplier) continue;

                let tempScore = 0;
                for (const [message, count] of Object.entries(messages)) {
                    let messageMultiplier = messageMultipliers[message];
                    if (messageMultiplier === 0) continue;
                    if (!messageMultiplier) messageMultiplier = 1;

                    tempScore += count * messageMultiplier;
                }
                score += multiplier * tempScore;
            }

            if (score > maxScore || maxScoredFormat === null) {
                maxScore = score;
                maxScoredFormat = format;
            }
        }

        return maxScoredFormat;
    }

    /**
     * Info about the validation of a specific format used to save tree data for bookmarks.
     * 
     * @typedef {Object} BookmarkFormatValidationInfo
     * @property {Object<string, number>} Info.validated
     * @property {Object<string, number>} Info.warnings
     * @property {Object<string, number>} Info.errors
     */

    /**
     * Check if a bookmark folder stores bookmarks with tree data according to a certain format.
     *
     * @static
     * @param {Object} Params Parameters
     * @param {BookmarkTreeNode} Params.rootBookmark The root bookmark that should be checked to see if it conforms to the tree data format.
     * @param {string} Params.format A format that specifies how the bookmarks store tree information.
     * @returns {null | BookmarkFormatValidationInfo} Info about the validation of the specified format.
     * @memberof TreeInfoNode
     */
    static validateBookmarkFormat({ rootBookmark, format }) {
        if (!rootBookmark || rootBookmark.type !== 'folder') {
            // Only bookmark folders are supported as root bookmarks.
            return null;
        }
        if (!format || typeof format !== 'string') {
            return null;
        }
        const info = {
            validated: {},
            warnings: {},
            errors: {},
        };
        const addMessage = (obj, type, count = 1) => {
            if (type in obj) {
                obj[type] += count;
            } else {
                obj[type] = count;
            }
        };
        const valid = (type, count = 1) => {
            addMessage(info.validated, type, count);
        };
        const warn = (type, count = 1) => {
            addMessage(info.warnings, type, count);
        };
        const error = (type, count = 1) => {
            addMessage(info.errors, type, count);
        };
        switch (format) {
            case TreeInfoNode.bookmarkFormat.folders: {
                /** @param {BookmarkTreeNode} folderBookmark A folder to scan. */
                const processFolder = (folderBookmark) => {
                    /** First item might be a separator for compatibility with separator format. */
                    let first = true;
                    /** First bookmark is usually the parent tab. */
                    let firstBookmark = true;
                    /** If there is a folder before the first bookmark then all tabs should be on the same level. */
                    let startWithFolder = false;
                    /** The folder started with a separator item for compatibility with separator format. This is incorrect if the folder starts with a folder. */
                    let separatorCompatibility = false;
                    /** Indicates if there was any child tabs connected to the first bookmark. */
                    let hasChild = false;
                    for (const bookmark of folderBookmark.children) {
                        switch (bookmark.type) {
                            case 'separator': {
                                if (first) {
                                    separatorCompatibility = true;
                                } else {
                                    warn('separator');
                                }
                            } break;

                            case 'bookmark': {
                                if (!startWithFolder) {
                                    // This folder's first bookmark is a parent tab!
                                    if (firstBookmark) {
                                        // This is the parent tab!
                                        if (separatorCompatibility) {
                                            valid('separatorCompatibility');
                                        }
                                    } else {
                                        // This is a child tab!
                                        valid('parentChildRelationship');
                                        if (!hasChild) {
                                            valid('increasedTreeLevel');
                                            hasChild = true;
                                        }
                                    }
                                }
                                firstBookmark = false;
                            } break;

                            case 'folder': {
                                if (!startWithFolder) {
                                    if (firstBookmark) {
                                        startWithFolder = true;
                                        if (separatorCompatibility) {
                                            warn('separator');
                                        }
                                    } else {
                                        // The top bookmark in this folder should be a child tab of the current folder's parent tab.
                                        valid('parentChildRelationship');
                                        if (!hasChild) {
                                            valid('increasedTreeLevel');
                                            hasChild = true;
                                        }
                                    }
                                }
                                processFolder(bookmark);
                            } break;
                        }
                        first = false;
                    }
                    if (firstBookmark) {
                        warn('emptyFolder');
                    } else if (!startWithFolder && !hasChild) {
                        // There was only 1 bookmark (the parent) but we expected at least 2.
                        warn('emptyTreeLevel');
                    }
                };
                processFolder(rootBookmark);
            } break;

            case TreeInfoNode.bookmarkFormat.separators: {
                /** @param {BookmarkTreeNode} folderBookmark A folder to scan. */
                const processFolder = (folderBookmark) => {
                    let currentTreeLevel = 0;
                    let nextIsParent = false;
                    let hasChild = true;
                    let hasChildStack = [];

                    let separatorsInRowCount = 0;
                    const handleSeparators = () => {
                        if (separatorsInRowCount % 2 === 1) {
                            nextIsParent = true;
                        }

                        const endedTreeLevels = Math.floor(separatorsInRowCount / 2);
                        if (endedTreeLevels > 0) {
                            if (!hasChild) {
                                warn('emptyTreeLevel');
                            }
                            for (let iii = nextIsParent ? /* Skip the latest tree level since we never pushed a value for it */ 1 : 0; iii < endedTreeLevels; iii++) {
                                hasChild = hasChildStack.pop() || false;
                            }
                        }

                        currentTreeLevel -= endedTreeLevels;
                        if (currentTreeLevel < 0) {
                            error('corruptTreeLevels', Math.abs(currentTreeLevel));
                            currentTreeLevel = 0;
                        }
                        if (currentTreeLevel === 0) {
                            // These are root tabs and don't count as reaching new tree levels.
                            hasChild = true;
                        }

                        separatorsInRowCount = 0;
                    };

                    for (const bookmark of folderBookmark.children) {
                        if (bookmark.type !== 'separator') {
                            handleSeparators();
                        }
                        switch (bookmark.type) {
                            case 'separator': {
                                separatorsInRowCount++;
                            } break;

                            case 'bookmark': {
                                if (currentTreeLevel > 0) {
                                    valid('parentChildRelationship');
                                }
                                if (nextIsParent) {
                                    nextIsParent = false;
                                    currentTreeLevel++;
                                    valid('parentDefinition');

                                    // Track wether this parent ever gets any children:
                                    hasChildStack.push(hasChild);
                                    hasChild = false;
                                } else if (!hasChild) {
                                    valid('increasedTreeLevel');
                                    hasChild = true;
                                }
                            } break;

                            case 'folder': {
                                if (currentTreeLevel > 0) {
                                    valid('parentChildRelationship');
                                }
                                if (nextIsParent) {
                                    error('invalidParentDefinition');
                                } else if (!hasChild) {
                                    valid('increasedTreeLevel');
                                    hasChild = true;
                                }
                                processFolder(bookmark);
                            } break;
                        }
                    }

                    handleSeparators();
                    if (currentTreeLevel > 0) {
                        warn('unendedTreeLevels', currentTreeLevel);
                    }
                    if (nextIsParent) {
                        error('invalidParentDefinition');
                    }
                };
                processFolder(rootBookmark);
            } break;

            case TreeInfoNode.bookmarkFormat.titles: {
                // Start on negative number so that the first bookmark is ensured to have tree level 0.
                let currentTreeLevel = -1;
                for (const bookmark of rootBookmark.children) {
                    if (bookmark.type !== 'bookmark') {
                        if (bookmark.type === 'separator') {
                            warn('separator');
                        } else {
                            error('folder');
                        }
                        continue;
                    }

                    // Parse Wanted Tree Level from bookmark's title:
                    let treeLevel = 0;
                    for (let iii = 0; iii < bookmark.title.length; iii++) {
                        const c = bookmark.title[iii];
                        if (c === '>') continue;
                        if (c === ' ') treeLevel = iii;
                        break;
                    }

                    if (treeLevel > currentTreeLevel + 1) {
                        // Can't increase tree level more than one step at a time.
                        error('corruptTreeLevels');
                    } else if (currentTreeLevel >= 0 && treeLevel > currentTreeLevel) {
                        valid('increasedTreeLevel');
                    }
                    if (treeLevel > 0) {
                        valid('parentChildRelationship');
                    }
                    currentTreeLevel = treeLevel;
                }
            } break;

            default:
                throw new Error(`Unsupported bookmark tree structure format: ${format}`);
        }
        return info;
    }

    // #endregion Bookmark Format


    // #endregion Static

}
TreeInfoNode.instanceTypes = Object.freeze({
    bookmark: 'bookmark',
    tab: 'tab',
});

/** @typedef { 'bookmarkFolders' | 'bookmarkSeparators' | 'bookmarkTitles' } BookmarkFormat The format used to store tree information using bookmarks. */
/**
 * The format used to store tree information using bookmarks.
 */
TreeInfoNode.bookmarkFormat = Object.freeze({
    /**
     * This format uses bookmark folders to store tree information. 
     * 
     * The first bookmark in a bookmark folder represents the parent tab and the rest of 
     * the bookmarks in the folder are child tabs of that parent tab. If the first item in 
     * the bookmark folder is a bookmark folder then the bookmarks will be interpreted as 
     * top level tabs.
     */
    folders: 'bookmarkFolders',
    /**
     * This format uses bookmark separators to store tree information. 
     * 
     * An odd number of separators before a bookmark indicates that the bookmark is a 
     * parent tab. Bookmarks after such a parent tab bookmark are considered children of it. 
     * A pair of bookmark separators in a row decreases the tree level of bookmarks after 
     * that point.
     */
    separators: 'bookmarkSeparators',
    /**
     * This format uses bookmark titles to store tree information and is the format used to 
     * store tree information by Tree Style Tab v3.2.0 and later (earlier versions couldn't 
     * store tree information at all).
     * 
     * Tree structure is saved by appending `>` characters at the beginning of a bookmark's 
     * title followed by a space and then the tab's actual title. The number of `>` characters 
     * determine what tree level the bookmark should be restored at. When the bookmarks are 
     * created any bookmark title that begins with some `>` characters followed by a space are 
     * trimmed so that they don't cause issues.
     */
    titles: 'bookmarkTitles',
});
