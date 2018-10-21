/*
 * @name         Komica Host Matcher
 * @description  Check we are at board of which host
 * @namespace    https://github.com/usausausausak
 * @version      0.1.2
 *
 * Supported host identitys:
 *   komica.org  => komica
 *   komica2.net => komica
 *   2cat.tk     => 2cat
 *
 * // Returns the host id, or returns null while the `location` isn't a supported host.
 * function Komica.hostMatcher(location: Location) -> (nullable)String
 *
 * // Returns the host id, or returns the provided `err` while the `location` isn't a supported host.
 * function Komica.hostMatcherOr(location: Location, err: String) -> String
 */

if (typeof Komica === 'undefined') {
  this.Komica = {};
}

(function komicaPostQueryer(Komica) {
  'use strict'

  const MATCHER = {
      'komica': /^([^\.]*\.)?komica2?\.(org|net)$/,
      '2cat':   /^2cat\.tk$/,
  };

  function hostMatcher(location) {
    const host = location.host.replace(/:\d+$/, '');
    for (let [name, matcher] of Object.entries(MATCHER)) {
        if (matcher.test(host)) {
            return name;
        }
    }
    return null;
  }

  function hostMatcherOr(location, err) {
    const host = hostMatcher(location);
    return (host) ? host : err;
  }

  if (typeof Komica === 'object') {
    Object.entries({
      'hostMatcher':   hostMatcher,
      'hostMatcherOr': hostMatcherOr,
    }).forEach(([key, fn]) => {
      if (Komica[key] === undefined) {
        Komica[key] = fn;
      }
    });
  }
})(this.Komica);
