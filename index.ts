declare const browser: any;



// /** @typedef { { [key: string]: { newValue: any, oldValue: any } } } ChangeInfo */

// /**
//  * Map the values in an object.
//  *
//  * @template {string} K
//  * @template T
//  * @template U
//  * @param {Record<K, T>} obj Input object.
//  * @param {function(T): U} f Map function.
//  * @returns {Record<K, U>} A modified object.
//  */
// function mapObject(obj, f) {
//     const mapped = {};
//     for (const key in Object.keys(obj)) {
//         mapped[key] = f(obj[key]);
//     }
//     // @ts-ignore
//     return mapped;
// }



// #region From ts-essentials


/** Mark some properties which only the former including as optional and set the value to never
 *
 *  Source: https://github.com/krzkaczor/ts-essentials/blob/d91bb2a78d706b20b5a79ffe6f658a1cf296cdf2/lib/types.ts#L287
*/
declare type Without<T, U> = { [P in Exclude<keyof T, keyof U>]?: never };

/** get the XOR type which could make 2 types exclude each other
 *
 *  Source: https://github.com/krzkaczor/ts-essentials/blob/d91bb2a78d706b20b5a79ffe6f658a1cf296cdf2/lib/types.ts#L289
*/
declare type XOR<T, U> = T | U extends object ? (Without<T, U> & U) | (Without<U, T> & T) : T | U;


// #endregion From ts-essentials