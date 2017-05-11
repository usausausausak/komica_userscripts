// ==UserScript==
// @name         Komica notify
// @namespace    https://github.com/usausausausak
// @description  Notify new post every 60seconds on komica
// @include      http://*.komica.org/*/pixmicat.php?res=*
// @include      https://*.komica.org/*/pixmicat.php?res=*
// @include      http://*.komica2.net/*/pixmicat.php?res=*
// @include      https://*.komica2.net/*/pixmicat.php?res=*
// @version      1.1.3
// @grant        none
// ==/UserScript==
(function (window) {
    const selfId = "[Komica_notify]";

    const GET_POST_LIST_URL = "./pixmicat.php?mode=module&load=mod_ajax&action=thread&html=true&op=";
    const FETCH_TIMEOUT = 30 * 1000;
    const PULL_INTERVAL = 60 * 1000;

    let ThreadNo = document.querySelector(".threadpost").dataset.no;
    let PostNos = new Set();
    document.querySelectorAll(".post")
        .forEach(post => PostNos.add(post.dataset.no));
    let Posts = new Map();

    let PageTitle = document.title;
    let GetPostsUrl = GET_POST_LIST_URL + ThreadNo;
    let updateTimer = null;

    let NewPost = 0;
    let ResetRead = true;

    function setGetDiff(lhs, rhs) {
        let set = new Set(lhs);
        rhs.forEach(v => set.delete(v));
        return set;
    }

    async function wait(msec) {
        return new Promise(resolve => setTimeout(() => resolve(), msec));
    }

    async function getPosts() {
        return new Promise((resolve, reject) => {
            let req = new XMLHttpRequest();
            req.open("GET", GetPostsUrl);
            req.responseType = "json";
            req.timeout = FETCH_TIMEOUT;
            req.onload = function () {
                if (req.status === 200) {
                    resolve(req.response);
                } else {
                    reject(req.status);
                }
            };
            req.onerror = function () {
                reject("error");
            };
            req.ontimeout = function () {
                reject("timeout");
            };
            req.send();
        });
    }

    function setDeletedPost(postNo) {
        let post = document.querySelector(`#r${postNo}`);
        if (post) {
            post.style.opacity = 0.5;
            post.style.transition = "opacity 100ms";
        }
    }

    function removeReadFlagElement() {
        let flag = document.querySelector("#notify-read-flag");
        if (flag) {
            flag.parentElement.removeChild(flag);
        }
    }

    function getReadFlagElement() {
        let flag = document.querySelector("#notify-read-flag");
        if (!flag) {
            flag = document.createElement("span");
            flag.id = "notify-read-flag";
            flag.className = "warn_txt2";
            flag.innerHTML = "ここまで読んだ";
            flag.style = `display: flex; justify-content: center;
                          width: 30%;`;
        }
        return flag;
    }

    async function elementFadeIn(element, interval, factor) {
        if (element.style.opacity === null) {
            element.style.opacity = 0;
        }

        let opacity = +element.style.opacity; // style.opacity is a string
        if (opacity >= 1) {
            element.style.opacity = null;
        } else {
            element.style.opacity = factor + opacity;
            await wait(interval);
            elementFadeIn(element, interval, factor);
        }
    }

    async function displayPost(iter) {
        let value = iter.next();
        if (value.done) {
            return;
        }

        let post = value.value[1];
        // fadein in javascript to reduce impact on stylesheet
        elementFadeIn(post, 10, 0.1); // total 100ms

        await wait(50);
        displayPost(iter);
    }

    function renderNewPost(postNos, postDataMap, setReadFlag = false) {
        let container = document.querySelector("#threads > .thread");
        let insertPoint = container.querySelector("hr");

        // set read flag if necessary
        if (setReadFlag) {
            container.insertBefore(getReadFlagElement(), insertPoint);
        }

        NewPost += postNos.size;
        document.title = `${PageTitle} (${NewPost})`;

        console.log(selfId, `Have new post: ${postNos.size}.`);
        let posts = [];
        for (let postNo of postNos) {
            if (!postDataMap.has(postNo)) {
                continue;
            }
            let postData = postDataMap.get(postNo);

            let postBlock = document.createElement("div");
            postBlock.innerHTML = postData.html.replace(/^[^<]*/, "");

            let post = postBlock.childNodes[0];
            post.style.opacity = 0;

            container.insertBefore(post, insertPoint);
            PostNos.add(postNo);
            posts.push(post);
        }

        // fadein new posts
        let iter = posts.entries();
        displayPost(iter);
    }

    function activeScript() {
        // remove exists event
        let elementsWithEvent = ([
            "#postform_main",
            ".post-head > span",
            ".file-thumb",
        ]).join(",");

        document.querySelectorAll(elementsWithEvent).forEach(element => {
            let clone = element.cloneNode();
            while (element.firstChild) {
                clone.appendChild(element.lastChild);
            }
            element.parentNode.replaceChild(clone, element);
        });

        // remove auto created element
        let elementsParentNeedRemove = ([
            ".quote .-expand-youtube",
        ]).join(",");
        document.querySelectorAll(elementsParentNeedRemove).forEach(element => {
            element = element.parentNode;
            element.parentNode.removeChild(element);
        });

        // run script.js
        let script = document.createElement("script");
        script.setAttribute("src","/common/js/script.js");
        document.head.appendChild(script);
        script.addEventListener("load",
                                function () {
                                    document.head.removeChild(this);
                                },
                                false);
    }

    async function updateWait(msec) {
        return new Promise(resolve => {
            updateTimer = setTimeout(() => resolve(), msec);
        });
    }

    async function updatePosts(immediately = false) {
        clearTimeout(updateTimer);
        updateTimer = null;

        if (!immediately) {
            await updateWait(PULL_INTERVAL);
        }

        let resetReadFlag = ResetRead;
        if (ResetRead) {
            ResetRead = false;
            NewPost = 0;
        }

        startLoad();
        try {
            let postDatas = (await getPosts()).posts;

            let postDataMap = new Map(
                postDatas.map(post => [post.no.toString(), post]));

            let postNos = postDatas.map(post => post.no.toString());

            // find deleted post
            let deletedPostNos = setGetDiff(PostNos, postNos);
            deletedPostNos.forEach(setDeletedPost);

            // find new posts
            let newPostNos = setGetDiff(postNos, PostNos);

            if (newPostNos.size) {
                renderNewPost(newPostNos, postDataMap, resetReadFlag);

                try {
                    activeScript();
                } catch (ex) {
                    console.error(selfId, ex);
                }

                window.postMessage({ event: "notify-new-posts",
                                     posts: Array.from(newPostNos)
                                   } , "*");
            } else {
                if (resetReadFlag) {
                    removeReadFlagElement();
                }
                console.log(selfId, "No new post.")
            }
        } catch (ex) {
            console.error(selfId, `Fail: ${ex}, retry at ${PULL_INTERVAL}.`);
        }

        endLoad();

        // next iterate
        console.log(selfId, `Last update: ${new Date()}.`);
        updatePosts();
    }

    // reload button
    function isLoading() {
        return reloadButton.classList.contains("notify-disabled");
    }

    function startLoad() {
        reloadButton.classList.add("notify-disabled");
        reloadButton.classList.remove("text-button");
        reloadButton.innerHTML = "読み込み中…";
    }

    function endLoad() {
        reloadButton.classList.remove("notify-disabled");
        reloadButton.classList.add("text-button");
        reloadButton.innerHTML = `新着 ${NewPost} 件。[再読み込み]`;
    }

    function manualReload() {
        if (!isLoading()) {
            ResetRead = true;
            updatePosts(true);
        }
    }

    let block = document.createElement("div");
    block.style = "display: flex; justify-content: center; width: 30%;";

    let reloadButton = document.createElement("span");
    reloadButton.id = "notify-reload";
    reloadButton.innerHTML = "[再読み込み]";
    reloadButton.className = "text-button";
    reloadButton.addEventListener("click", manualReload, false);

    let container = document.querySelector("#threads");
    block.appendChild(reloadButton);
    container.appendChild(block);

    // reset read flag if scrolled
    function readPostCb(ev) {
        document.title = PageTitle;

        ResetRead = true;
    }
    window.addEventListener("scroll", readPostCb, false);

    // event from other script
    function fetchNewPostCb(ev) {
        let event = ev.data;
        if (event.event === "fetch-new-posts") {
            manualReload();
        }
    }

    window.addEventListener("message", fetchNewPostCb, false);

    // start auto reload
    updatePosts();
})(window);
// vim: set sw=4 ts=4 sts=4 et:
