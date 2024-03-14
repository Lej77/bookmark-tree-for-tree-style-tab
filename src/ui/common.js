
import {
    messageTypes,
} from '../common/common.js';

import {
    createPrivacyPermissionArea as createPrivacyPermissionAreaInner,
} from '../ui/tst-privacy-permission.js';

import {
    PortConnection,
} from '../common/connections.js';
import { setTextMessages } from './utilities.js';


/**
 * @typedef {import('../ui/collapsable.js').AnimationInfo} AnimationInfo
 */
null;


// eslint-disable-next-line valid-jsdoc
/**
 * Create an area that informs about current privacy permissions configuration.
 *
 * @export
 * @param {Object} Params Parameters
 * @param {PortConnection} [Params.portConnection] Port to use for talking to background page.
 * @param {AnimationInfo} [Params.sectionAnimationInfo] Animation for section.
 */
export function createPrivacyPermissionArea({ portConnection = null, sectionAnimationInfo = null, }) {
    const obj = createPrivacyPermissionAreaInner({
        sectionAnimationInfo,

        titleMessage: 'privacyPermissions_Header',
        infoMessage: 'privacyPermissions_Info',

        warnAboutMisconfigurationMessage: 'privacyPermissions_warnAboutMisconfiguredPrivacySettings',
        warnAboutMisconfigurationSettingsKey: 'warnAboutMisconfiguredPrivacySettings',

        firefoxPrivacy_header_message: 'privacyPermissions_hasPrivacyPermission_Header',
        firefoxPrivacy_error_message: 'privacyPermissions_hasPrivacyPermission_Error',

        tstPrivacy_header_message: 'privacyPermissions_hasTreeStyleTabPrivacyPermission_Header',
        tstPrivacy_error_message: 'privacyPermissions_hasTreeStyleTabPrivacyPermission_Error',

        permissionGranted_message: 'permissions_Granted',
        permissionDenied_message: 'permissions_NotGranted',
    });

    // Get permissions info from background page:
    if (!portConnection) {
        portConnection = new PortConnection();
    }

    const permissionsEvent = portConnection.getEvent(messageTypes.privacyPermissionChanged);
    permissionsEvent.addListener(info => {
        obj.providePrivacyInfo(info);
    });
    browser.runtime.sendMessage({ type: messageTypes.privacyPermission })
        .then(info => {
            obj.providePrivacyInfo(info);
        })
        .catch(error => console.error('Failed to get privacy permissions info.\nError: ', error));

    setTextMessages(obj.area);

    return obj;
}