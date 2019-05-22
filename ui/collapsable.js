'use strict';

import {
  toggleClass,
} from '../ui/utilities.js';

import {
  defineProperty
} from '../common/utilities.js';


/**
 * An object with info that can be used to determine if a section is enabled.
 * 
 * @typedef {Object} EnabledChecker
 * @property {HTMLDivElement | HTMLDivElement[]} Data.element The element(s) that can be enabled.
 * @property {function(function()): boolean} Data.check A function that checks if an element is enabled. The argument is another function that can be called to say that an error occurred.
 */
null;

/**
 * Info about a binding between a collapsable section and a DOM element.
 * 
 * @typedef {Object} BoundCollapsableAreasInfo
 * @property {WeakMap<HTMLDivElement, CollapsableAreaInfo>} Info.sectionLookup Lookup to get the section info for each document element.
 * @property {Map<HTMLDivElement, function()>} Info.checkLookup Lookup to get the check function for each document element. Call this to re-check if the element's section should be enabled.
 * @property {function()} Info.checkAll Call this to re-check all element to see if they should be enabled.
 * @property {function()} Info.checkElement Call this to re-check an element to see if it should be enabled.
 */
null;

/**
 * A collapsable section that has a title that can be clicked to collapse/expand an area bellow it.
 * 
 * @typedef {Object} CollapsableAreaInfo
 * @property {HTMLDivElement} Info.area The div that represent the whole collapsable area.
 * @property {HTMLDivElement} Info.title The div that represent the sections header.
 * @property {HTMLDivElement} Info.content The div that represent the sections content. This can be collapsed to become hidden.
 * @property {boolean} Info.isButton Determines if the title area can be navigated to with the tab key.
 * @property {boolean} Info.isCollapsed Determines if the content area is hidden/collapsed.
 * @property {AnimationInfo} Info.animationInfo Determines the animation that is used to collapse and expand the content area.
 * 
 */
null;


/**
 * Find elements that are marked as sections and create sections for them.
 *
 * @export
 * @param {Object} details Configure how elements are bound to sections.
 * @param {string} details.sectionQuery The query that will be used to find the elements that should be bound to sections.
 * @param {AnimationInfo} details.animationInfo An animation info object to use for the created sections.
 * @param {EnabledChecker | EnabledChecker[]} details.enabledCheck An object that can be used to determine if an area is enabled or disabled.
 * @param {boolean} details.cacheEnabledStatus Determines if enable status is cached in a local variable for each element or if it is set to the DOM for every check.
 * @returns {BoundCollapsableAreasInfo} Info about the bound areas.
 */
export function bindCollapsableAreas({
  sectionQuery = '.sectionArea',
  animationInfo = null,
  enabledCheck = null,
  cacheEnabledStatus = true,
} = {}) {
  if (enabledCheck && !Array.isArray(enabledCheck)) {
    enabledCheck = [enabledCheck];
  }

  let originalAnimation = { standard: true };
  if (animationInfo) {
    originalAnimation = Object.assign({}, animationInfo);
  }
  animationInfo = AnimationInfo.asInfo(animationInfo);
  animationInfo.update({ standard: false });

  const sectionLookup = new WeakMap();
  const checkLookup = new Map();

  const sectionAreas = document.querySelectorAll(sectionQuery);
  for (const area of sectionAreas) {
    const section = createCollapsableArea(animationInfo);
    sectionLookup.set(area, section);

    const affectedChecks = enabledCheck && enabledCheck.filter(checker => {
      if (!checker || !checker.element) return false;
      if (Array.isArray(checker.element)) return checker.element.some(element => element === area);
      else return checker.element === area;
    });
    if (affectedChecks && affectedChecks.length > 0) {
      const checks = affectedChecks.map(checker => checker.check);
      let firstCheck = true;
      let isEnabled = false;
      let hasError = false;
      const check = () => {
        if (firstCheck) {
          section.title.classList.add('enablable');
          firstCheck = true;
        }

        let error = false;
        const setError = () => {
          error = true;
        };
        const enabled = checks.every(check => check(setError));

        if (!cacheEnabledStatus || isEnabled !== enabled) {
          toggleClass(section.title, 'enabled', enabled);
          isEnabled = enabled;
        }
        if (!cacheEnabledStatus || hasError !== error) {
          toggleClass(section.title, 'error', error);
          hasError = error;
        }
      };
      checkLookup.set(area, check);
    }

    section.isCollapsed = area.classList.contains('collapsed');
    section.title.classList.add('center');
    section.area.classList.add('standardFormat');
    area.parentElement.insertBefore(section.area, area);

    section.content.appendChild(area);

    if (area.children.length > 0) {
      const possibleHeaderNode = area.children[0];
      if (possibleHeaderNode.nodeName.toLowerCase() === 'header') {
        section.title.appendChild(possibleHeaderNode);
      }
    }
  }
  animationInfo.update(originalAnimation);

  return {
    sectionLookup,
    checkLookup,
    checkAll: () => {
      const checks = checkLookup.values();
      for (const check of checks) {
        check();
      }
    },
    checkElement: (ele) => {
      if (!ele) return;
      const check = checkLookup.get(ele);
      if (check) check();
    },
  };
}

/**
 * Information about the collapse and expand animation for a collapsable section.
 *
 * @export
 * @class AnimationInfo
 */
export class AnimationInfo {

  constructor(animationInfo = {}) {

    // #region Check Arg

    if (animationInfo === undefined) {
      animationInfo = {};
    } else if (!animationInfo) {
      animationInfo = { reset: true, standard: false };
    }
    if (!('standard' in animationInfo)) {
      animationInfo.standard = true;
    }
    animationInfo.reset = true;

    // #endregion Check Arg

    this.update(animationInfo);
  }

  /**
   * Return the object if it is an AnimationInfo. Otherwise create an AnimationInfo from it.
   *
   * @static
   * @param {Object} [obj={}] Object to convert into AnimationInfo.
   * @returns {AnimationInfo} An AnimationInfo object.
   * @memberof AnimationInfo
   */
  static asInfo(obj = {}) {
    if (obj && (obj instanceof AnimationInfo)) {
      return obj;
    } else {
      return new AnimationInfo(obj);
    }
  }

  static getStandardInfo() {
    return {
      collapseDuration: 200, expandDuration: 200,
      collapseDelay: 0, expandDelay: 0,
      collapseTransition: '', expandTransition: '',
      collapseDurationPerPixel: 0.4, expandDurationPerPixel: 0.4,
      collapseBodyImmediately: true, expandBodyImmediately: true,
    };
  }
  static getResetInfo() {
    return {
      duration: 0,
      delay: 0,
      transition: '',
      durationPerPixel: 0,
      bodyImmediately: false
    };
  }

  /**
   * Convert shortened ("standard") modifiers to their longer names.
   *
   * @param {Object} obj Object with keys that can be standard modifiers.
   * @returns {Object} The provided object with the standard keys removed.
   * @memberof AnimationInfo
   */
  static applyStandardModifiers(obj) {
    let standardKeys = Object.keys(AnimationInfo.getResetInfo());
    let keys = Object.keys(obj);
    for (let key of standardKeys) {
      if (keys.includes(key)) {
        let value = obj[key];
        let suffix = AnimationInfo.changeFirstLetter(key);
        obj['collapse' + suffix] = value;
        obj['expand' + suffix] = value;
        delete obj[key];
      }
    }
    return obj;
  }

  applyModifiers() {
    AnimationInfo.applyStandardModifiers(this);
  }

  update(changes) {
    if (changes !== this) {
      // Don't modify the provided object unless it is actually this object.
      changes = Object.assign({}, changes);
    }

    if (changes.reset) {
      Object.assign(this, AnimationInfo.getResetInfo());
    }
    delete changes.reset;

    // Ensure that there are no standard modifiers that will override new changes:
    this.applyModifiers();

    if (changes.standard) {
      Object.assign(this, AnimationInfo.getStandardInfo());
      // Don't need to apply changes since all standard keys are long names.
    }
    delete changes.standard;

    Object.assign(this, changes);
    this.applyModifiers();
  }

  static changeFirstLetter(string, toUpperCase = true) {
    let firstLetter = string.charAt(0);
    firstLetter = toUpperCase ? firstLetter.toUpperCase() : firstLetter.toLowerCase();
    return firstLetter + string.slice(1);
  }

  /**
   * Get an object that only contains the keys that start with a certain string.
   *
   * @param {*} prefix Prefix that all keys must begin with.
   * @returns {Object} Contains only the keys that have the correct prefix.
   * @memberof AnimationInfo
   */
  getPrefixed(prefix) {
    if (!prefix || typeof prefix !== 'string') {
      prefix = '';
    }
    const info = {};
    for (const [key, value] of Object.entries(this)) {
      if (key.startsWith(prefix)) {
        info[AnimationInfo.changeFirstLetter(key.slice(prefix.length), false)] = value;
      }
    }
    return info;
  }
}

/**
 * Create a collapsable area.
 *
 * @export
 * @param {AnimationInfo} animationInfo Info about the animation that will be used to collapse and expand the created area.
 * @returns {CollapsableAreaInfo} Info about the created section.
 */
export function createCollapsableArea(animationInfo = {}) {

  // #region Animation Info

  const setAnimationInfo = (value) => {
    if (value instanceof AnimationInfo) {
      animationInfo = value;
    } else {
      animationInfo = new AnimationInfo(value);
    }
  };
  setAnimationInfo(animationInfo);

  // #endregion Animation Info


  let area = document.createElement('div');
  area.classList.add('collapsable');
  area.classList.add('section');


  let headerArea = document.createElement('div');
  headerArea.classList.add('headerArea');
  headerArea.classList.add('textNotSelectable');
  area.appendChild(headerArea);

  let hoverIndicator = document.createElement('div');
  hoverIndicator.classList.add('hoverIndicator');
  headerArea.appendChild(hoverIndicator);


  let contentWrapper = document.createElement('div');
  contentWrapper.classList.add('contentWrapper');
  area.appendChild(contentWrapper);

  let contentArea = document.createElement('div');
  contentArea.classList.add('contentArea');
  contentWrapper.appendChild(contentArea);


  let isButton = false;
  // Make header behave as a button:
  const setIsButton = (value) => {
    value = Boolean(value);
    if (isButton === value) {
      return;
    }

    if (value) {
      headerArea.setAttribute('tabindex', 0);
      headerArea.setAttribute('role', 'button');
    } else {
      headerArea.removeAttribute('tabindex');
      headerArea.removeAttribute('role');
    }

    isButton = value;
  };
  setIsButton(true);

  headerArea.addEventListener('click', (e) => {
    let ele = e.target;
    while (true) {
      if (!ele || ele.classList.contains('preventOpen')) {
        return;
      }
      if (ele === headerArea) {
        break;
      }
      ele = ele.parentElement;
    }
    setCollapsed(!isCollapsed);
  });
  headerArea.addEventListener('keydown', (e) => {
    if (e.target !== headerArea)
      return;
    if (!isButton)
      return;
    if (e.target.classList.contains('preventOpen'))
      return;

    // 13 = Return, 32 = Space
    if (![13, 32].includes(e.keyCode))
      return;

    setCollapsed(!isCollapsed);
  });


  let isCollapsed = true;
  let collapseTimeoutId = null;
  let setCollapsed = (value) => {
    if (isCollapsed === value) {
      return;
    }
    let wasCollapsed = isCollapsed;
    isCollapsed = value;

    let info = animationInfo.getPrefixed(value ? 'collapse' : 'expand');
    let { duration = 0, delay = 0, transition = '', durationPerPixel = 0, bodyImmediately = false } = info;


    if (duration <= 0 && durationPerPixel <= 0) {
      toggleClass(area, 'collapsed', value);
      toggleClass(area, 'open', !value);
      return;
    }


    if (wasCollapsed) {
      toggleClass(area, 'collapsed', true);
    }
    toggleClass(area, 'open', true);
    let wantedHeight = contentWrapper.scrollHeight;


    if (durationPerPixel > 0) {
      duration += durationPerPixel * wantedHeight;
    }

    transition = 'max-height ' + duration + 'ms ' + transition;
    if (delay > 0) {
      transition += ' ' + delay + 'ms';
    } else {
      delay = 0;
    }


    contentWrapper.style.transition = transition;
    contentWrapper.style.maxHeight = wantedHeight + 'px';
    if (bodyImmediately) {
      if (value) {
        document.body.style.minHeight = document.body.scrollHeight + 'px';
      } else {
        let minBodyHeight = document.body.scrollHeight - contentWrapper.clientHeight + wantedHeight;
        if (minBodyHeight > document.body.style.minHeight) {
          document.body.style.minHeight = minBodyHeight + 'px';
        }
      }
    }


    let startTimeout = (callback, timeInMilliseconds) => {
      if (collapseTimeoutId !== null) {
        clearTimeout(collapseTimeoutId);
      }

      collapseTimeoutId = setTimeout(() => {
        collapseTimeoutId = null;
        callback();
      }, timeInMilliseconds);
    };

    // Ensure that max height is applied:
    contentWrapper.clientHeight;
    // Then start height change:
    toggleClass(area, 'collapsed', value);

    // Handle change completed:
    startTimeout(() => {
      toggleClass(area, 'open', !value);
      contentWrapper.style.maxHeight = null;
      contentWrapper.style.transition = null;
      document.body.style.minHeight = null;
    }, duration + delay);
  };
  setCollapsed(isCollapsed);


  const obj = {
    area: area,
    title: headerArea,
    content: contentArea,
  };
  defineProperty(obj, 'isButton', () => isButton, setIsButton);
  defineProperty(obj, 'isCollapsed', () => isCollapsed, setCollapsed);
  defineProperty(obj, 'animationInfo', () => animationInfo, setAnimationInfo);
  return obj;
}
