// ==UserScript==
// @name         Komica NGID
// @description  NG id and post on komica
// @namespace    https://github.com/usausausausak
// @include      http://*.komica.org/*/*
// @include      https://*.komica.org/*/*
// @include      http://*.komica2.net/*/*
// @include      https://*.komica2.net/*/*
// @include      http://komica2.net/*/*
// @include      https://komica2.net/*/*
// @include      http://2cat.cf/*/*/*
// @include      https://2cat.cf/*/*/*
// @version      1.9.2
// @require      https://cdn.rawgit.com/usausausausak/komica_userscripts/808e78c9e1bd9c3395b5f0369ee163fe2276241b/libs/komica_host_matcher.js
// @require      https://cdn.rawgit.com/usausausausak/komica_userscripts/71a86be3cf9d727c2e2a74f9689a2529e17fb22f/libs/komica_queryer.js
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// ==/UserScript==
(function () {
    "use strict";
    const TAG = "[Komica_NGID]";

    const HOST_ID = Komica.hostMatcherOr(document.location, 'unknown');
    console.debug(TAG, `We are at the board of host '${HOST_ID}'.`);

    const QUERYER = Komica.postQueryer(HOST_ID);

    // We need diffence style at diffence host. (how bad)
    const HOST_STYLE = {
        'komica': `
.ngid-context-menu {
    background-color: #EEAA88;
}

/*
 * All reply posts of the NGed thread post also be NGed.
 */
.ngid-ngthread > .reply,
.ngid-ngpost > *:not(.post-head),
.ngid-ngpost > .post-head > .title,
.ngid-ngpost > .post-head > .name {
    display: none;
}

.ngid-ngimage > .file-text,
.ngid-ngimage > .file-thumb {
    display: none;
}
        `,
        '2cat': `
.ngid-context-menu {
    background-color: #AAEEAA;
}

#toplink .text-button {
    cursor: pointer;
    color: #00E;
    text-decoration: underline;
}

#toplink .text-button:hover {
    color: #D00;
}

.ngid-context {
    cursor: pointer;
    color: #00E;
    margin-left: 0.2em; /* Nice try! */
}

.ngid-context .text-button:hover {
    color: #D00;
}

/*
 * Since we can't hide the text node, just leave them out.
 */
.ngid-ngpost .quote,
.ngid-ngpost .title,
.ngid-ngpost .name,
.ngid-ngpost .warn_txt2,
.threadpost.ngid-ngpost > div > a:not(:last-of-type),
.reply.ngid-ngpost > div > a:not(:first-of-type) {
    display: none;
}

.threadpost.ngid-ngimage > div > a:not(:last-of-type),
.reply.ngid-ngimage > div > a:not(:first-of-type) {
    display: none;
}

.ngid-ngpost > div > a.qlink,
.ngid-ngimage > div > a.qlink {
    display: unset;
}
        `,
    };

    // Mapping post no to meta data. (Global)
    //
    // # Type
    //
    // String => PostMetaObject{ id: String, no: String, isThreadPost: bool, isContainsNgWord: bool, contextMenuRoot: HTMLElement }
    const postMetas = {};

    // Setting. (Global)
    // TODO: Move reusable code to a independent module.
    const settings = (function () {
        let eventListener = { onadd: [], onremove: [], onclear: [], onswap: [] };

        function addEventListener(name, cb) {
            if (!eventListener[name]) {
                // ignore unknown event
                return;
            }
            if (typeof cb === "function") {
                eventListener[name].push(cb);
            } else {
                console.warn(TAG, "event listener not a function");
            }
        }

        function emitEvent(name, ...args) {
            try {
                eventListener[name].forEach(cb => cb(...args));
            } catch (ex) {
                console.error(TAG, ex);
            }
        }

        let tablePrefix = (function (loc) {
            let boardName = loc.pathname.split(/\//).slice(0, -1).join("/");
            return loc.host + boardName;
        })(document.location);

        function jsonReplacer(key, value) {
            if (key === "creationTime") {
                return new Date(value);
            } else {
                return value;
            }
        }

        let lists = { ngIds: [], ngNos: [], ngWords: [], ngImages: [] };
        for (let key of Object.keys(lists)) {
            let tableName = `${tablePrefix}/${key}`;
            try {
                let list = JSON.parse(GM_getValue(tableName, ""),
                                      jsonReplacer);
                lists[key] = list;
            } catch (ex) {
                console.warn(TAG, `fail at read ${key}`);
            }
            console.info(TAG, `${key} have ${lists[key].length} items.`);
        }

        function saveNg(key) {
            let tableName = `${tablePrefix}/${key}`;
            try {
                let jsonStr = JSON.stringify(lists[key]);
                GM_setValue(tableName, jsonStr);
            } catch (ex) {
                console.error(TAG, ex);
            }
        }

        function findNg(key, value) {
            if (!Array.isArray(lists[key])) {
                throw new Error("Invalid key");
            }

            return lists[key].find(v => v.value === value);
        }

        function addNg(key, value) {
            if (!Array.isArray(lists[key])) {
                throw new Error("Invalid key");
            } else if (lists[key].some(v => value === v.value)) {
                return false;
            }

            lists[key].push({ value: value, creationTime: new Date() });
            saveNg(key);

            emitEvent("onadd", key, value);
            return true;
        }

        function removeNg(key, value) {
            if (!Array.isArray(lists[key])) {
                throw new Error("Invalid key");
            }

            lists[key] = lists[key].filter(v => v.value !== value);
            saveNg(key);

            emitEvent("onremove", key, value);
            return true;
        }

        function clearNg(key, predicate = null) {
            if (!Array.isArray(lists[key])) {
                throw new Error("Invalid key");
            }

            if (typeof predicate === "function") {
                lists[key] = lists[key].filter(predicate)
            } else {
                lists[key] = [];
            }
            saveNg(key);

            emitEvent("onclear", key);
        }

        // unsafe
        function swapNg(key, list) {
            if (!Array.isArray(lists[key])) {
                throw new Error("Invalid key");
            }

            const oldList = lists[key];
            lists[key] = list;
            saveNg(key);

            emitEvent("onswap", key);

            return oldList;
        }

        return {
            get ngIds() { return lists.ngIds.map(v => v.value); },
            get ngNos() { return lists.ngNos.map(v => v.value); },
            get ngWords() { return lists.ngWords.map(v => v.value); },
            get ngImages() { return lists.ngImages.map(v => v.value); },
            findNg, addNg, removeNg, clearNg, swapNg,
            on(eventName, cb) { addEventListener(`on${eventName}`, cb); },
        };
    })();

    // TODO: Move reusable code to a independent module.
    function createSettingPanel(settings) {
        let tabBox = (function (ns) {
            let eventListener = { onswitch: [] };

            function addEventListener(name, cb) {
                if (!eventListener[name]) {
                    // ignore unknown event
                    return;
                }
                if (typeof cb === "function") {
                    eventListener[name].push(cb);
                } else {
                    console.warn(TAG, "event listener not a function");
                }
            }

            function emitEvent(name, ...args) {
                try {
                    eventListener[name].forEach(cb => cb(...args));
                } catch (ex) {
                    console.error(TAG, ex);
                }
            }

            let tabBox = document.createElement("div");
            tabBox.className = `${ns}-tabbox-header`;
            let pageBox = document.createElement("div");
            pageBox.className = `${ns}-tabbox-container`;

            let pages = [];
            let currentSelected = -1;

            function addPage(title) {
                let index = pages.length;

                let page = document.createElement("div");
                page.className = `${ns}-tabbox-page`;
                pageBox.appendChild(page);

                let tab = document.createElement("div");
                tab.className = `${ns}-tabbox-tab`;
                tab.innerHTML = title;
                tab.addEventListener("click", () => switchTab(index), false);
                tabBox.appendChild(tab);

                pages.push({ page, tab });
                return page;
            }

            function getPage(index) {
                if ((index < 0) || (index >= pages.length)) {
                    console.error(TAG, `invalid tab index: ${index}`);
                    return null;
                }

                return pages[index].page;
            }

            function switchTab(index) {
                if ((index < 0) || (index >= pages.length)) {
                    console.error(TAG, `invalid tab index: ${index}`);
                    return;
                } else if (currentSelected === index) {
                    return;
                }

                let prevIndex = currentSelected;
                let { page, tab } = pages[index];

                // emit before show to make time to render
                currentSelected = index;
                emitEvent("onswitch", index, page);

                // hide current tab
                if (prevIndex >= 0) {
                    // hide current tab
                    let { page, tab } = pages[prevIndex];
                    tab.classList.remove(`${ns}-tabbox-selected`);
                    page.classList.remove(`${ns}-tabbox-selected`);
                }

                tab.classList.add(`${ns}-tabbox-selected`);
                page.classList.add(`${ns}-tabbox-selected`);
            }

            function getCurrentPage() {
                if ((currentSelected < 0) || (currentSelected >= pages.length)) {
                    return null;
                } else {
                    return pages[currentSelected].page;
                }
            }

            return {
                get currentSelected() { return currentSelected; },
                set currentSelected(index) { switchTab(index); },
                getCurrentPage,
                addPage, getPage,
                appendTo(parent) {
                    parent.appendChild(tabBox);
                    parent.appendChild(pageBox);
                },
                on(eventName, cb) { addEventListener(`on${eventName}`, cb); },
            };
        })("ngid");

        let ngLists = [
            {
                title: "NGID", description: "指定したIDのスレ/レスを隠す",
                key: "ngIds", prefix: "ID:", lineEdit: false,
                replacer(value) {
                    value = value.replace(/^ID:/, "");
                    return value;
                },
            },
            {
                title: "NGNo", description: "指定したスレ/レスを隠す",
                key: "ngNos", prefix: "No.", lineEdit: false,
                replacer(value) {
                    value = value.replace(/^No./, "");
                    if (value.match(/\D/)) {
                        return "";
                    }
                    return value;
                },
            },
            {
                title: "NGWord", description: "指定した文字列を含むスレ/レスを隠す",
                key: "ngWords", prefix: "", lineEdit: true,
                replacer(value) { return value; },
            },
            {
                title: "NGImage", description: "指定したIDのイラストを隠す",
                key: "ngImages", prefix: "ID:", lineEdit: false,
                replacer(value) {
                    value = value.replace(/^ID:/, "");
                    return value;
                },
            },
        ];
        ngLists.forEach(({ title }) => tabBox.addPage(title));

        function getCurrentListData() {
            let currentSelected = tabBox.currentSelected;
            return (currentSelected < 0) ? null : ngLists[currentSelected];
        }

        function renderLineEdit(root, listData) {
            root.innerHTML = "";

            const { title, description, key, prefix, lineEdit, replacer } = listData;

            const textView = document.createElement("textarea");
            textView.classList.add("ngid-lineedit-textview");
            textView.value = settings[key].join("\n");

            const saveView = document.createElement("div");
            saveView.classList.add("ngid-lineedit-saveview");
            saveView.appendChild(document.createTextNode(description));

            const saveButton = document.createElement("button");
            saveButton.innerHTML = "保存";
            saveButton.addEventListener("click",
                ev => {
                    const lists = textView.value.split(/\n/)
                        .map(v => replacer(v).trim())
                        .filter(v => v.length > 0)
                        .map(v => {
                            return { value: v, creationTime: new Date() };
                        });
                    // swapNg will occur render and back to listview
                    // unsafe
                    settings.swapNg(key, lists);
                }, false);
            saveView.appendChild(saveButton);

            // We need a block to fillup the page.
            const outerBlock = document.createElement("div");
            outerBlock.style.cssText = 'display: flex; flex-direction: column; height: 100%; width: 100%';
            outerBlock.appendChild(saveView);
            outerBlock.appendChild(textView);

            root.appendChild(outerBlock);
        }

        function removeItemCb(ev) {
            let listData = getCurrentListData();
            if (listData === null) {
                return;
            }

            let button = ev.target;
            settings.removeNg(listData.key, button.dataset.value);
        }

        function createListitem(value, prefix = "") {
            let view = document.createElement("div");
            view.className = "ngid-listitem";

            let dataBlock = document.createElement("span");
            dataBlock.innerHTML = `${prefix}${value}`;
            view.appendChild(dataBlock);

            let delButton = document.createElement("span");
            delButton.className = "ngid-text-button";
            delButton.innerHTML = "削除";
            delButton.dataset.value = value;
            delButton.addEventListener("click", removeItemCb, false);
            view.appendChild(delButton);
            return view;
        }

        function createInputField(placeholder, replacer) {
            let view = document.createElement("div");
            view.className = "ngid-inputfield";

            let textField = document.createElement("input");
            textField.placeholder = placeholder;
            view.appendChild(textField);

            let addButton = document.createElement("button");
            addButton.innerHTML = "追加";
            addButton.addEventListener("click",
                ev => {
                    let listData = getCurrentListData();
                    if (listData === null) {
                        return;
                    }

                    let value = replacer(textField.value).trim();
                    if (value !== "") {
                        settings.addNg(listData.key, value);
                        textField.value = "";
                    }
                    textField.focus();
                }, false);
            view.appendChild(addButton);
            return view;
        }

        function renderList(root, listData) {
            root.innerHTML = "";

            let { title, description, key, prefix, lineEdit, replacer } = listData;

            let inputField = createInputField(description, replacer);
            root.appendChild(inputField);

            if (lineEdit) {
                const editButton = document.createElement("button");
                editButton.classList.add("ngid-lineedit-button");
                editButton.innerHTML = "編集";
                editButton.addEventListener("click",
                    () => renderLineEdit(root, listData), false);

                inputField.appendChild(editButton);
            }

            // create items list
            let lists = settings[key];
            let items = lists.map(data => createListitem(data, prefix));
            items.reverse();
            items.forEach(item => root.appendChild(item));
        }

        tabBox.on("switch",
                  (pageIdx, root) => renderList(root, ngLists[pageIdx]));

        // rerender current list if it is openning
        function renderCurrentListCb(key) {
            let listData = getCurrentListData();
            if ((listData !== null) && (listData.key === key)) {
                let root = tabBox.getCurrentPage();
                renderList(root, listData);
            }
        }

        settings.on("add", renderCurrentListCb);
        settings.on("remove", renderCurrentListCb);
        settings.on("clear", renderCurrentListCb);
        settings.on("swap", renderCurrentListCb);

        GM_addStyle(`
.ngid-dialog {
    visibility: hidden;
    position: fixed;
    top: -10px;
    z-index: 1;
    opacity: 0;
    display: flex;
    flex-direction: column;
    width: 40%;
    height: 50%;
    margin: 0 30%;
    overflow: hidden;
    border-radius: 5px;
    box-shadow: 0 0 15px 5px #5f5059;
    background-color: #FFFFEE;
    transition: top 100ms, visibility 100ms, opacity 100ms;
}

.ngid-dialog-show {
    visibility: visible;
    opacity: 1;
    top: 30px;
}

.ngid-tabbox-header {
    display: flex;
    justify-content: center;
    background-color: #F0E0D6;
}

.ngid-tabbox-tab {
    cursor: pointer;
    flex: 1;
    padding: 7px 12px;
    color: #800000;
    font-weight: bold;
}

.ngid-tabbox-tab:hover {
    background-color: #EEAA88;
}

.ngid-tabbox-tab.ngid-tabbox-selected {
    background-color: #EEAA88;
}

.ngid-tabbox-container {
    display: flex;
    flex: 1;
    overflow-y: auto;
}

.ngid-tabbox-page {
    width: 0;
    opacity: 0;
    overflow-y: scroll;
    overflow-x: hidden;
    transition: opacity 200ms;
}

.ngid-tabbox-page.ngid-tabbox-selected {
    width: 100%;
    opacity: 1;
    padding: 0 10px;
}

.ngid-listitem {
    cursor: pointer;
    display: flex;
    justify-content: space-between;
    padding: 5px 10px;
    margin: 2px 0;
    color: #800000;
}

.ngid-listitem:hover {
    background-color: #EEAA88;
}

.ngid-inputfield {
    display: flex;
    justify-content: center;
    padding: 7px 5px;
    border-bottom: 1px solid #000;
}

.ngid-inputfield input {
    flex: 1;
}

.ngid-lineedit-button {
    margin-left: 10px;
}

.ngid-lineedit-saveview {
    display: flex;
    justify-content: space-between;
    padding: 7px 5px;
}

.ngid-lineedit-textview {
    flex: 1;
}
        `);

        function toggleDialog() {
            dialog.classList.toggle("ngid-dialog-show");
            if (dialog.classList.contains("ngid-dialog-show")) {
                tabBox.currentSelected = 0;
            }
        }

        let dialog = document.createElement("div");
        dialog.id = "ngid-setting-dialog";
        dialog.className = "ngid-dialog";
        tabBox.appendTo(dialog);

        let closeBut = document.createElement("button");
        closeBut.style.cssText = "align-self: flex-end; margin: 10px 20px";
        closeBut.innerHTML = "閉じる";
        closeBut.addEventListener("click", toggleDialog, false);
        dialog.appendChild(closeBut);

        document.body.insertBefore(dialog, document.body.firstChild);

        let toggleButton = document.createElement("a");
        toggleButton.className = "text-button";
        toggleButton.innerHTML = "NGID";
        toggleButton.addEventListener("click", toggleDialog, false);

        let insertPoint = document.querySelector("#toplink a:last-of-type");
        let parent = insertPoint.parentElement;
        insertPoint = insertPoint.nextSibling;
        parent.insertBefore(document.createTextNode("] ["), insertPoint);
        parent.insertBefore(toggleButton, insertPoint);
    }

    function addNgIdButtonCb(ev) {
        let id = this.dataset.id;
        if (settings.addNg("ngIds", id)) {
            console.log(`add NGID ${id}`);
        }
    }

    function addNgNoButtonCb(ev) {
        let no = this.dataset.no;
        if (settings.addNg("ngNos", no)) {
            console.log(`add NGNO ${no}`);
        } else {
            console.log(`remove NGNO ${no}`);
            settings.removeNg("ngNos", no);
        }
    }

    function addNgImageButtonCb(ev) {
        let id = this.dataset.id;
        if (settings.addNg("ngImages", id)) {
            console.log(TAG, `add NGImage ${id}`);
        } else {
            console.log(`remove NGImage ${id}`);
            settings.removeNg("ngImages", id);
        }
    }

    function renderContextMenu(post, postMeta, ngState) {
        const postId = postMeta.id;
        const postNo = postMeta.no;
        const isThreadPost = postMeta.isThreadPost;
        const root = postMeta.contextMenuRoot;

        // Remove the menu body.
        while (root.lastChild) {
            root.removeChild(root.lastChild);
        }

        let menu = document.createElement("div");
        menu.className = "ngid-context-menu";
        root.appendChild(menu);
        root.appendChild(document.createTextNode("NG"));

        let postType = (isThreadPost) ? "スレ" : "レス";
        if (ngState === "ngword") {
            menu.appendChild(document.createTextNode(
                `この${postType}にはNGWordsが含まれている。`));
        } else if (ngState === "ngid") {
            menu.appendChild(document.createTextNode(
                `このIDはNGIDに指定されている。`));
        } else {
            // Only show buttons of enabled function.
            if (postNo) {
                let ngNoButton = document.createElement("div");
                ngNoButton.className = "ngid-text-button";
                ngNoButton.dataset.no = postNo;
                if (ngState == "ngno") {
                    ngNoButton.innerHTML = `この${postType}を現す`;
                } else {
                    ngNoButton.innerHTML = `この${postType}を隠す`;
                }
                ngNoButton.addEventListener("click", addNgNoButtonCb, false);

                menu.appendChild(ngNoButton);
            }

            if (postId) {
                let ngIdButton = document.createElement("div");
                ngIdButton.className = "ngid-text-button";
                ngIdButton.dataset.id = postId;
                ngIdButton.innerHTML = `ID:${postId}をNGIDに追加`;
                ngIdButton.addEventListener("click", addNgIdButtonCb, false);
                menu.appendChild(ngIdButton);

                let ngImageButton = document.createElement("div");
                ngImageButton.className = "ngid-text-button";
                ngImageButton.dataset.id = postId;
                if (isNgImage(post)) {
                    ngImageButton.innerHTML = `ID:${postId}のイラストを表す`;
                } else {
                    ngImageButton.innerHTML = `ID:${postId}のイラストを隠す`;
                }
                ngImageButton.addEventListener("click",
                                               addNgImageButtonCb,
                                               false);
                menu.appendChild(ngImageButton);
            }
        }
    }

    function isNgImage(post) {
        return post.classList.contains("ngid-ngimage");
    }

    function setNgState(post, isNg) {
        if (isNg) {
            if (post.classList.contains("threadpost")) {
                post.parentElement.classList.add("ngid-ngthread");
            }
            post.classList.add("ngid-ngpost");
        } else {
            if (post.classList.contains("threadpost")) {
                post.parentElement.classList.remove("ngid-ngthread");
            }
            post.classList.remove("ngid-ngpost");
        }
    }

    function setNgImage(post, isNg) {
        if (isNg) {
            post.classList.add("ngid-ngimage");
        } else {
            post.classList.remove("ngid-ngimage");
        }
    }

    function isContainsNgWord(post) {
        const postBody = QUERYER.queryBody(post) || "";
        const threadTitle = QUERYER.queryThreadTitle(post) || "";
        return settings.ngWords.some(word => ((postBody.includes(word)) || (threadTitle.includes(word))));
    }

    // Init and store the meta data of the `post`.
    //
    // This function maybe called twice for a post due to the thread expanding,
    // but we don't mind and just reinit the post.
    function initPostMeta(post) {
        // Only when we know the post no.
        const postNo = QUERYER.queryNo(post);
        if (!postNo) {
            return;
        }

        post.dataset.ngidNo = postNo; // For convenience.

        const postMeta = {
            no: postNo,
            id: QUERYER.queryId(post),
            isThreadPost: QUERYER.isThreadPost(post),
            isContainsNgWord: isContainsNgWord(post),
            contextMenuRoot: null,
        };

        postMetas[postNo] = postMeta;

        // Insert the context menu root and create the menu.
        const insertPoint = QUERYER.afterPostNoEl(post);
        if (insertPoint) {
            let parent = insertPoint.parentElement;

            let contextMenuRoot = document.createElement("span");
            contextMenuRoot.className = "text-button ngid-context";
            parent.insertBefore(contextMenuRoot, insertPoint);

            postMeta.contextMenuRoot = contextMenuRoot;

            renderContextMenu(post, postMeta, "");
        }
    }

    function updateNgWordState() {
        for (let post of QUERYER.queryPosts()) {
            const postMeta = postMetas[post.dataset.ngidNo];
            if (postMeta) {
                postMeta.isContainsNgWord = isContainsNgWord(post);
            }
        }
    }

    function updateNgState() {
        for (let post of QUERYER.queryPosts()) {
            const postMeta = postMetas[post.dataset.ngidNo];
            if (!postMeta) {
                continue;
            }

            let isNgPost = post.classList.contains("ngid-ngpost");
            let ngState = "";
            if (postMeta.isContainsNgWord) {
                ngState = "ngword";
            } else if (settings.ngIds.includes(postMeta.id)) {
                ngState = "ngid";
            } else if (settings.ngNos.includes(postMeta.no)) {
                ngState = "ngno";
            }

            let needNgImage = settings.ngImages.includes(postMeta.id);

            setNgState(post, ngState !== "");
            setNgImage(post, needNgImage);

            // no touch if it isn't and wasn't a NGed post
            if ((isNgPost)
                || (ngState !== "")
                || (isNgImage(post) == needNgImage)) {
                let context = post.querySelector(".ngid-context");
                renderContextMenu(post, postMeta, ngState);
            }
        }

        // A workaround for non-structured layout.
        if (HOST_ID === "2cat") {
            for (let post of QUERYER.queryThreads()) {
                const isNgThread = post.classList.contains("ngid-ngpost");
                let el = post.nextSibling;
                while ((el) && (!(el instanceof HTMLHRElement))) {
                    if (QUERYER.isReplyPost(el)) {
                        if (isNgThread) {
                            el.classList.add("ngid-destroy");
                        } else {
                            el.classList.remove("ngid-destroy");
                        }
                    }
                    el = el.nextSibling;
                }
            }
        }
    }

    (function main() {
        createSettingPanel(settings);

        // Shared style.
        GM_addStyle(`
.ngid-destroy {
    display: none;
}

.ngid-ngpost {
    opacity: 0.3;
}

.ngid-text-button {
    cursor: pointer;
    color: #00E;
}

.ngid-text-button:hover {
    color: #D00;
}

.ngid-context-menu {
    display: inline-block;
    visibility: hidden;
    position: absolute;
    padding: 5px 10px;
    border-radius: 5px;
    margin-top: -10px;
    transition: margin 100ms;
}

.ngid-context:hover .ngid-context-menu {
    visibility: visible;
    margin-top: unset;
}

.ngid-ngpost .ngid-context-menu {
    color: #D00;
}

.popup_area .ngid-context {
    display: none;
}
        `);

        // Host-dependent style.
        if (HOST_STYLE[HOST_ID]) {
            GM_addStyle(HOST_STYLE[HOST_ID]);
        }

        // Init all posts' NG state.
        for (let post of QUERYER.queryPosts()) {
            initPostMeta(post);
        }
        updateNgState();

        // Observing the thread expansion.
        // TODO: Move reusable code to a independent module.
        let threadObserver = new MutationObserver(function (records) {
            let postReplys = records.reduce((total, record) => {
                for (let node of record.addedNodes) {
                    if (QUERYER.isReplyPost(node)) {
                        total.push(node);
                    }
                }
                return total;
            } , []);
            let replySize = postReplys.length;
            console.log(`Reply size change: ${replySize}`);

            postReplys.forEach(initPostMeta);
            updateNgState();
        });

        for (let thread of QUERYER.queryThreads()) {
            threadObserver.observe(thread, { childList: true });
        }

        // Binding with the setting update.
        function onSettingChangeCb(key) {
            if (key === "ngWords") {
                updateNgWordState();
            }
            updateNgState();
        }
        settings.on("add", onSettingChangeCb);
        settings.on("remove", onSettingChangeCb);
        settings.on("clear", onSettingChangeCb);
        settings.on("swap", onSettingChangeCb);
    })();
})();
