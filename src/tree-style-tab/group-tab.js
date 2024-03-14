'use strict';


export const kTST_LEGACY_GROUP_URL = 'about:treestyletab-group';
export const kTST_GROUP_URL = 'ext+treestyletab:group';

/**
 * @typedef {Object} GroupTabInfo
 * @property {string|null} [Info.name] The title of the group tab.
 * @property {boolean|undefined} [Info.temporary] Indicates if the group tab is temporary.
 * @property {string|null} [Info.internalId] The internal id for Tree Style Tab. If this is `null` then the group tab uses the legacy group tab URL.
 * @property {string|null} [Info.urlArguments] All arguments that should be suffixed to the group tab URL.
 * @property {boolean} [Info.newFallbackURL] `true` if the web extension fallback URL is used instead of the legacy group tab URL.
 */
null;


/**
 * Get the URL for a group tab.
 *
 * @export
 * @param {GroupTabInfo} Info Information used to generate the group tabs URL. If `urlArguments` is provided then the `temporary` and `name` arguments are ignored.
 * @returns {string} URL for the specified group tab.
 */
export function getGroupTabURL({ name = null, temporary = undefined, internalId = null, urlArguments = null, newFallbackURL = false } = {}) {
    let url = internalId ? 'moz-extension://' + internalId + '/resources/group-tab.html' : (newFallbackURL ? kTST_GROUP_URL : kTST_LEGACY_GROUP_URL);
    if (urlArguments || urlArguments === '') {
        url += urlArguments;
        return url;
    }
    let firstArg = true;
    const prepareForArg = () => {
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

/**
 * Try to parse a URL as a Tree Style Tab group tab and return the parsed information.
 *
 * @export
 * @param {null|string} url The URL to parse.
 * @returns {GroupTabInfo|null} Info - Information about the parsed URL or `null` if the URL couldn't be parsed.
 */
export function getGroupTabInfo(url) {
    if (!url || typeof url !== 'string') {
        return null;
    }
    const removeLength = (string, removeLength) => {
        return string.length <= removeLength ? '' : string.substr(removeLength);
    };

    let internalId = null;
    let newFallbackURL = false;

    if (url.startsWith(kTST_LEGACY_GROUP_URL)) {
        url = removeLength(url, kTST_LEGACY_GROUP_URL.length);
    } else if (url.startsWith(kTST_GROUP_URL)) {
        url = removeLength(url, kTST_GROUP_URL.length);
        newFallbackURL = true;
    } else {
        const start = 'moz-extension://';
        if (!url.startsWith(start)) {
            return null;
        }
        url = removeLength(url, start.length);

        const separatorIndex = url.indexOf('/');
        if (separatorIndex < 0) {
            return null;
        }
        internalId = url.substr(0, separatorIndex);
        url = removeLength(url, separatorIndex + 1);

        const location = 'resources/group-tab.html';
        if (!url.startsWith(location)) {
            return null;
        }
        url = removeLength(url, location.length);
    }

    const info = {
        internalId: internalId,
        urlArguments: url,
        newFallbackURL,
    };


    if (url.startsWith('?')) {
        url = removeLength(url, 1);

        const getInfo = (arg, id, key, handleValue) => {
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
        const tests = [
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
        for (const arg of url.split('&')) {
            for (const test of tests) {
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
