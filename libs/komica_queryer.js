/*
 * @name         Komica Post Queryer
 * @description  Get a queryer that can query the meta data of posts on board of Komica.
 * @namespace    https://github.com/usausausausak
 * @version      0.1.0
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
 *   // You can use `insertBefore` to insert a node after the No.
 *   static afterPostNo: function (post: HTMLElement) -> (nullable)HTMLElement,
 * }
 */

if (typeof Komica === 'undefined') {
  this.Komica = {};
}

(function komicaPostQueryer(Komica) {
  'use strict'

  const POST_META_QUERYERS = {
    komica: {
      // Matches the host name.
      matcher: /^([^\.]*)\.komica2?\.(org|net)$/,
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
        let idEl = post.querySelector('.post-head .id') ||
          post.querySelector('.post-head .now');

        if (idEl) {
          return idEl.dataset.id || idEl.innerHTML.replace(/^.*ID:/, '');
        } else {
          return null;
        }
      },
      queryBody: function queryBodyKomica(post) {
        let bodyEl = post.getElementsByClassName('quote');
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
      afterPostNo: function afterPostNoKomica(post) {
        const noEl = post.querySelector('.post-head [data-no]');
        if (noEl) {
          return noEl.nextSibling;
        } else {
          return null;
        }
      },
    }
  }

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
    queryBody: function queryBodyNull(post) {
      return null;
    },
    isThreadPost: function isThreadPostNull(post) {
      return false;
    },
    isReplyPost: function isReplyPostNull(post) {
      return false;
    },
    afterPostNo: function afterPostNoNull(post) {
      return null;
    },
  };

  function postQueryer(host) {
    host = host.replace(/:[0-9]*$/, '');

    let ret = NULL_QUERYER;
    for (let queryer of Object.values(POST_META_QUERYERS)) {
      if (queryer.matcher.test(host)) {
        ret = queryer;
      }
    }
    return Object.assign({}, ret);
  }

  if ((typeof Komica === 'object') && (!Komica.postQueryer)) {
    Komica.postQueryer = postQueryer;
  }
})(this.Komica);
