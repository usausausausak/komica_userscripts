// ==UserScript==
// @name         Komica notify
// @description  Notify new post every 60seconds on komica
// @namespace    https://github.com/usausausausak
// @include      http://*.komica.org/*/pixmicat.php?res=*
// @include      https://*.komica.org/*/pixmicat.php?res=*
// @version      1
// @grant        none
// ==/UserScript==
(function (window) {
    const GET_POST_LIST_URL = "./pixmicat.php?mode=module&load=mod_ajax&action=thread&html=true&op=";
    const PULL_INTERVAL = 60 * 1000; // mircosec

    let ThreadNo = document.querySelector(".threadpost").dataset.no;
    let PostNos = new Set();
    document.querySelectorAll(".post")
        .forEach(post => PostNos.add(post.dataset.no));
    let Posts = new Map();

    let PageTitle = document.title;
    let GetPostsUrl = GET_POST_LIST_URL + ThreadNo;
    let Timer = null;

    let NewPost = 0;
    let ResetRead = true;

    function setGetDiff(lhs, rhs) {
        let set = new Set(lhs);
        rhs.forEach(v => set.delete(v));
        return set;
    }

    async function wait(msec) {
        return new Promise(resolve => Timer = setTimeout(() => resolve(),
                           msec));
    }

    async function getPosts() {
        return new Promise((resolve, reject) => {
            console.log(`Get ${GetPostsUrl}`);
            let req = new XMLHttpRequest();
            req.open("GET", GetPostsUrl);
            req.responseType = "json";
            req.onload = function () {
                if ((req.readyState === 4) && (req.status === 200)) {
                    resolve(req.response);
                } else {
                    reject(req.response);
                }
            };
            req.send();
        });
    }

    function setDeletedPost(postNo) {
        let post = document.querySelector(`#r${postNo}`);
        if (post) {
            post.style.opacity = 0.5;
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

    function renderNewPost(postNos, postDataMap, setReadFlag = false) {
        let container = document.querySelector("#threads > .thread");
        let insertPoint = container.querySelector("hr");

        // set read flag if necessary
        if (setReadFlag) {
            container.insertBefore(getReadFlagElement(), insertPoint);
        }

        NewPost += postNos.size;
        document.title = `${PageTitle} (${NewPost})`;

        console.log(`Have new post: ${postNos.size}.`);
        for (let postNo of postNos) {
            if (!postDataMap.has(postNo)) {
                continue;
            }
            let post = postDataMap.get(postNo);

            let postBlock = document.createElement("div");
            postBlock.innerHTML = post.html.replace(/^[^<]*/, "");

            container.insertBefore(postBlock.childNodes[0], insertPoint);
            PostNos.add(postNo);
        }
    }

    function activeScript() {
        // remove dup event
        document.querySelectorAll(`.post-head > span,
                                   .resquote > a`).forEach(element => {
            let clone = element.cloneNode();
            while (element.firstChild) {
                clone.appendChild(element.lastChild);
            }
            element.parentNode.replaceChild(clone, element);
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

    async function updatePosts(immediately = false) {
        if (!immediately) {
            await wait(PULL_INTERVAL);
        }

        let resetReadFlag = ResetRead;
        if (ResetRead) {
            ResetRead = false;
            NewPost = 0;
        }

        startLoad();
        try {
            let postDatas = (await getPosts()).posts;
            console.log(`Rev post: ${postDatas.length}.`);

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
                    console.log(ex);
                }

                window.postMessage({ event: "notify-new-posts",
                                     posts: Array.from(newPostNos)
                                   } , "*");
            } else {
                if (resetReadFlag) {
                    removeReadFlagElement();
                }
                console.log("No new post.")
            }
        } catch (ex) {
            console.log(`Fail ${ex}, retry at ${PULL_INTERVAL}.`);
        }

        endLoad();

        // next iterate
        console.log(`Last update: ${new Date()}.`);
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
            clearTimeout(Timer);
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
