/*
 * @name         Komica Post Queryer
 * @description  Get a queryer that can query the meta data of posts on board of Komica.
 * @namespace    https://github.com/usausausausak
 * @version      0.4.1
 *
 * function Komica.postQueryer(host: String) -> PostQueryer
 *
 * class PostQueryer {
 *   // Returns all threads on the current page.
 *   static queryThreads: function () -> Array-like[HTMLElement],
 *
 *   // Returns all posts on the current page.
 *   static queryPosts: function () -> Array-like[HTMLElement],
 *
 *   // Returns the No of the `post`.
 *   static queryNo: function (post: HTMLElement) -> (nullable)String,
 *
 *   // Returns the poster's ID of the `post`.
 *   static queryId: function (post: HTMLElement) -> (nullable)String,
 *
 *   // Returns the title of the `post` or returns null if that isn't a thread post.
 *   static queryThreadTitle: function (post: HTMLElement) -> (nullable)String,
 *
 *   // Returns the poster's name of the `post`.
 *   static queryName: function (post: HTMLElement) -> (nullable)String,
 *
 *   // Returns the body of the `post`.
 *   static queryBody: function (post: HTMLElement) -> (nullable)String,
 *
 *   // Returns true if the `post` is a thread post.
 *   static isThreadPost: function (post: HTMLElement) -> bool,
 *
 *   // Returns true if the `post` is a reply post.
 *   static isReplyPost: function (post: HTMLElement) -> bool,
 *
 *   // Returns a point after the No of the `post`.
 *   //
 *   // You can use `insertBefore` to insert a node after the No element.
 *   static afterPostNoEl: function (post: HTMLElement) -> (nullable)HTMLElement,
 * }
 */

if (typeof Komica === 'undefined') {
  this.Komica = {};
}

(function komicaPostQueryer(Komica) {
  'use strict'

  const POST_NO_FROM_POST_EL_ID_REGEXP = /^r(\d+)$/;

  const ID_FROM_NOWID_TEXT_REGEXP = /ID:(.+?)(?:\].*)?$/;
  function idFromNowIdText(nowIdText) {
    const matches = ID_FROM_NOWID_TEXT_REGEXP.exec(nowIdText);
    return (matches) ? matches[1] : null;
  }

  function idWithTailFromNowIdText(nowIdText) {
    const matches = ID_FROM_NOWID_TEXT_REGEXP.exec(nowIdText);
    if (!matches) {
      return null;
    } else {
      // Maybe has a id tail code, but we just ignore that.
      return matches[1].substr(0, 8);
    }
  }

  const QUERYERS_KOMICA = {
    queryThreads: function queryThreadsKomica() {
      return document.getElementsByClassName('thread');
    },
    queryPosts: function queryPostsKomica() {
      return document.getElementsByClassName('post');
    },
    queryNo: function queryNoKomica(post) {
      if (post.dataset) {
        return post.dataset.no;
      } else {
        return null;
      }
    },
    queryId: function queryIdKomica(post) {
      const idEl = post.querySelector('.post-head .id');
      if (idEl) {
        return idEl.dataset.id;
      } else {
        const nowEl = post.querySelector('.post-head .now');
        if (nowEl) {
          return idFromNowIdText(nowEl.innerHTML);
        } else {
          return null;
        }
      }
    },
    queryThreadTitle: function queryThreadTitleKomica(post) {
      let titleEl = post.querySelector('span.title');
      if (titleEl) {
        return titleEl.innerText;
      } else {
        return null;
      }
    },
    queryName: function queryNameKomica(post) {
      let nameEl = post.querySelector('span.name');
      if (nameEl) {
        return nameEl.innerText;
      } else {
        return null;
      }
    },
    queryBody: function queryBodyKomica(post) {
      let bodyEl = post.querySelector('.quote');
      if (bodyEl) {
        return bodyEl.innerText;
      } else {
        return null;
      }
    },
    isThreadPost: function isThreadPostKomica(post) {
      return ((post.classList) && (post.classList.contains('threadpost')));
    },
    isReplyPost: function isReplyPostKomica(post) {
      return ((post.classList) && (post.classList.contains('reply')));
    },
    afterPostNoEl: function afterPostNoElKomica(post) {
      const noEl = post.querySelector('.post-head [data-no]');
      if (noEl) {
        return noEl.nextSibling;
      } else {
        return null;
      }
    },
  };

  const QUERYERS_2CAT = {
    queryThreads: function queryThreads2Cat() {
      return document.getElementsByClassName('threadpost');
    },
    queryPosts: function queryPosts2Cat() {
      return document.querySelectorAll('.threadpost, .reply');
    },
    queryNo: function queryNo2Cat(post) {
      const matches = POST_NO_FROM_POST_EL_ID_REGEXP.exec(post.id);
      if (matches) {
        return matches[1];
      } else {
        return null;
      }
    },
    queryId: function queryId2Cat(post) {
      const postHeadEl = post.querySelector('div:first-child label');
      if (postHeadEl) {
        return idWithTailFromNowIdText(postHeadEl.innerText);
      } else {
        return null;
      }
    },
    queryThreadTitle: function queryThreadTitle2Cat(post) {
      let titleEl = post.querySelector('span.title');
      if (titleEl) {
        return titleEl.innerText;
      } else {
        return null;
      }
    },
    queryName: function queryName2Cat(post) {
      let nameEl = post.querySelector('span.name');
      if (nameEl) {
        return nameEl.innerText;
      } else {
        return null;
      }
    },
    queryBody: function queryBody2Cat(post) {
      let bodyEl = post.querySelector('div:first-child .quote');
      if (bodyEl) {
        return bodyEl.innerText;
      } else {
        return null;
      }
    },
    isThreadPost: function isThreadPost2Cat(post) {
      return ((post.classList) && (post.classList.contains('threadpost')));
    },
    isReplyPost: function isReplyPost2Cat(post) {
      return ((post.classList) && (post.classList.contains('reply')));
    },
    afterPostNoEl: function afterPostNoEl2Cat(post) {
      const noEl = post.querySelector('div:first-child .qlink');
      if (noEl) {
        return noEl.nextSibling;
      } else {
        return null;
      }
    },
  };

  const QUERYERS_GZONE_ANIME = {
    ...QUERYERS_2CAT,
    queryId: function queryIdGzoneAnime(post) {
      const postHeadEl = post.querySelector('span.name').nextSibling;
      if ((postHeadEl) && (postHeadEl.nodeType === 3)) {
        return idFromNowIdText(postHeadEl.nodeValue);
      } else {
        return null;
      }
    },
    queryBody: function queryBodyGzoneAnime(post) {
      let bodyEl = post.querySelector('div:first-child .quote');
      if (bodyEl) {
        const body = bodyEl.innerText;
        let pushPostEl = bodyEl.querySelector('.pushpost');
        if (pushPostEl) {
          return body.substr(0, body.length - pushPostEl.innerText.length);
        } else {
          return body;
        }
      } else {
        return null;
      }
    },
  };

  const NULL_QUERYER = {
    queryThreads: function queryThreadsNull() {
      return [];
    },
    queryPosts: function queryPostsNull() {
      return [];
    },
    queryNo: function queryNoNull(post) {
      return null;
    },
    queryId: function queryIdNull(post) {
      return null;
    },
    queryThreadTitle: function queryThreadTitleNull(post) {
      return null;
    },
    queryName: function queryNameNull(post) {
      return null;
    },
    queryBody: function queryBodyNull(post) {
      return null;
    },
    isThreadPost: function isThreadPostNull(post) {
      return false;
    },
    isReplyPost: function isReplyPostNull(post) {
      return false;
    },
    afterPostNoEl: function afterPostNoElNull(post) {
      return null;
    },
  };

  const MAPPER = {
    'komica': QUERYERS_KOMICA,
    '2cat':   QUERYERS_2CAT,
    'gzone-anime': QUERYERS_GZONE_ANIME,
  };

  function postQueryer(host) {
    let ret = (MAPPER[host]) ? MAPPER[host] : NULL_QUERYER;
    return Object.assign({}, ret);
  }

  if ((typeof Komica === 'object') && (Komica.postQueryer === undefined)) {
    Komica.postQueryer = postQueryer;
  }
})(this.Komica);
