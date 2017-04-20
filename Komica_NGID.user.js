// ==UserScript==
// @name         Komica NGID
// @description  NG id and post on komica
// @namespace    https://github.com/usausausausak
// @include      http://*.komica.org/*/*
// @include      https://*.komica.org/*/*
// @version      1.5.2
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// ==/UserScript==
(function (window) {
    let selfId = "[Komica_NGID]";
    let selfSetting = (function () {
        let eventListener = { onadd: [], onremove: [], onclear: [], };

        function addEventListener(name, cb) {
            if (!eventListener[name]) {
                // ignore unknown event
                return;
            }
            if (typeof cb === "function") {
                eventListener[name].push(cb);
            } else {
                console.warn(selfId, "event listener not a function");
            }
        }

        function emitEvent(name, ...args) {
            try {
                eventListener[name].forEach(cb => cb(...args));
            } catch (ex) {
                console.error(selfId, ex);
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

        let lists = { ngIds: [], ngNos: [], ngWords: [] };
        for (let key of Object.keys(lists)) {
            let tableName = `${tablePrefix}/${key}`;
            try {
                let list = JSON.parse(GM_getValue(tableName, ""),
                                      jsonReplacer);
                lists[key] = list;
            } catch (ex) {
                console.warn(selfId, `fail at read ${key}`);
            }
            console.info(selfId, `${key} have ${lists[key].length} items.`);
        }

        function saveNg(key) {
            let tableName = `${tablePrefix}/${key}`;
            try {
                let jsonStr = JSON.stringify(lists[key]);
                GM_setValue(tableName, jsonStr);
            } catch (ex) {
                console.error(selfId, ex);
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

        return {
            get ngIds() { return lists.ngIds.map(v => v.value); },
            get ngNos() { return lists.ngNos.map(v => v.value); },
            get ngWords() { return lists.ngWords.map(v => v.value); },
            findNg, addNg, removeNg, clearNg,
            on(eventName, cb) { addEventListener(`on${eventName}`, cb); },
        };
    })();

    // create setting panel
    (function (setting) {
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
                    console.warn(selfId, "event listener not a function");
                }
            }

            function emitEvent(name, ...args) {
                try {
                    eventListener[name].forEach(cb => cb(...args));
                } catch (ex) {
                    console.error(selfId, ex);
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
                    console.error(selfId, `invalid tab index: ${index}`);
                    return null;
                }

                return pages[index].page;
            }

            function switchTab(index) {
                if ((index < 0) || (index >= pages.length)) {
                    console.error(selfId, `invalid tab index: ${index}`);
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
                title: "NGID", key: "ngIds", prefix: "ID:",
                replacer(value) {
                    value = value.replace(/^ID:/, "");
                    return value;
                },
            },
            {
                title: "NGNo", key: "ngNos", prefix: "No.",
                replacer(value) {
                    value = value.replace(/^No./, "");
                    if (value.match(/\D/)) {
                        return "";
                    }
                    return value;
                },
            },
            {
                title: "NGWord", key: "ngWords", prefix: "",
                replacer(value) { return value; },
            },
        ];
        ngLists.forEach(({ title }) => tabBox.addPage(title));

        function getCurrentListData() {
            let currentSelected = tabBox.currentSelected;
            return (currentSelected < 0) ? null : ngLists[currentSelected];
        }

        function removeItemCb(ev) {
            let listData = getCurrentListData();
            if (listData === null) {
                return;
            }

            let button = ev.target;
            setting.removeNg(listData.key, button.dataset.value);
        }

        function createListitem(value, prefix = "") {
            let view = document.createElement("div");
            view.className = "ngid-listitem";

            let dataBlock = document.createElement("span");
            dataBlock.innerHTML = `${prefix}${value}`;
            view.appendChild(dataBlock);

            let delButton = document.createElement("span");
            delButton.className = "text-button";
            delButton.innerHTML = "Delete";
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
            addButton.innerHTML = "Add";
            addButton.addEventListener("click",
                ev => {
                    let listData = getCurrentListData();
                    if (listData === null) {
                        return;
                    }

                    let value = replacer(textField.value).trim();
                    if (value !== "") {
                        setting.addNg(listData.key, value);
                        textField.value = "";
                    }
                    textField.focus();
                }, false);
            view.appendChild(addButton);
            return view;
        }

        function renderList(root, listData) {
            let { title, key, prefix, replacer } = listData;

            // remove all child
            while (root.lastChild) {
                root.removeChild(root.lastChild);
            }

            let placeholder = `Add a ${title}`;
            let inputField = createInputField(placeholder, replacer);
            root.appendChild(inputField);

            let lists = setting[key];
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

        setting.on("add", renderCurrentListCb);
        setting.on("remove", renderCurrentListCb);
        setting.on("clear", renderCurrentListCb);

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
                border-radius: 5px;
                box-shadow: 0 0 10px #000;
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
                padding: 5px 10px;
                border-bottom-width: 0;
                color: #800000;
                font-weight: bold;
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
                display: flex;
                flex-direction: column;
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
            }

            .ngid-listitem:hover {
                background-color: #EEAA88;
            }

            .ngid-inputfield {
                display: flex;
                justify-content: center;
                padding: 3px 0;
                border-bottom: 1px solid #000;
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
        closeBut.innerHTML = "Close";
        closeBut.addEventListener("click", toggleDialog, false);
        dialog.appendChild(closeBut);

        document.body.insertBefore(dialog, document.body.firstChild);

        let toggleButton = document.createElement("a");
        toggleButton.className = "text-button";
        toggleButton.innerHTML = "NGID";
        toggleButton.addEventListener("click", toggleDialog, false);

        let toplink = document.querySelector("#toplink");
        toplink.appendChild(document.createTextNode(" ["));
        toplink.appendChild(toggleButton);
        toplink.appendChild(document.createTextNode("]"));
    }(selfSetting));

    // main
    GM_addStyle(`
        .ngid-ngthread > .reply,
        .ngid-ngpost > *:not(.post-head),
        .ngid-ngpost > .post-head > .title,
        .ngid-ngpost > .post-head > .name {
            display: none;
        }

        .ngid-ngpost {
            opacity: 0.3;
        }

        .ngid-button > div {
            display: inline-block;
            visibility: hidden;
            position: absolute;
            padding: 5px 10px;
            background-color: rgba(238, 170, 136, 0.9);
            border-radius: 5px;
            overflow: hidden;
            white-space: nowrap;
            max-height: 0px;
            transition: max-height 200ms;
        }

        .ngid-button:hover > div {
            visibility: visible;
            max-height: 200px;
        }
    `);

    function addNgPost(post) {
        if (post.classList.contains("threadpost")) {
            post.parentElement.classList.add("ngid-ngthread");
        }
        post.classList.add("ngid-ngpost");
    }

    function removeNgPost(post) {
        if (post.classList.contains("threadpost")) {
            post.parentElement.classList.remove("ngid-ngthread");
        }
        post.classList.remove("ngid-ngpost");
    }

    function refreshNgList() {
        document.querySelectorAll(".post").forEach(post => {
            let needNg = post.dataset.ngidContainsWord === "true" ||
                         selfSetting.ngIds.includes(post.dataset.ngidId) ||
                         selfSetting.ngNos.includes(post.dataset.no);
            if (needNg) {
                addNgPost(post);
            } else {
                removeNgPost(post);
            }
        });
    }

    // add NG button
    function addNgIdCb(ev) {
        let id = this.dataset.id;
        if (selfSetting.addNg("ngIds", id)) {
            console.log(`add NGID ${id}`);
        }
    }

    function addNgNoCb(ev) {
        let no = this.dataset.no;
        if (selfSetting.addNg("ngNos", no)) {
            console.log(`add NGNO ${no}`);
        } else {
            console.log(`remove NGNO ${no}`);
            selfSetting.removeNg("ngNos", no);
        }
    }

    function markPostContent(post) {
        let contentBlock = post.querySelector(".quote");
        let postContent = contentBlock.innerText;
        post.dataset.ngidContainsWord = selfSetting.ngWords.some(
            word => postContent.includes(word));
    }

    function initPost(post) {
        let idBlock = post.querySelector(".post-head .id") ||
            post.querySelector(".post-head .now");

        let postNo = post.dataset.no;
        let postId = idBlock.dataset.id ||
            idBlock.innerHTML.replace(/^.*ID:/, "");

        // marker
        post.dataset.ngidId = postId;
        markPostContent(post);

        // create ng button if necessary
        if (post.querySelector(".ngid-button")) {
            return;
        }

        let ngButton = document.createElement("span");
        ngButton.className = "text-button ngid-button";

        let delButton = post.querySelector(".post-head .-del-button");
        let parent = delButton.parentElement;
        parent.insertBefore(ngButton, delButton);

        let ngButtonContainer = document.createElement("div");
        ngButton.appendChild(ngButtonContainer);
        ngButton.appendChild(document.createTextNode("NG"));

        let ngIdButton = document.createElement("div");
        ngIdButton.className = "text-button";
        ngIdButton.dataset.id = postId;
        ngIdButton.innerHTML = `NGID: ${postId}`;
        ngIdButton.addEventListener("click", addNgIdCb, false);

        let ngNoButton = document.createElement("div");
        ngNoButton.className = "text-button";
        ngNoButton.dataset.no = postNo;
        ngNoButton.innerHTML = `Toggle NG post: No.${postNo}`;
        ngNoButton.addEventListener("click", addNgNoCb, false);

        ngButtonContainer.appendChild(ngNoButton);
        ngButtonContainer.appendChild(ngIdButton);
    }

    document.querySelectorAll(".post").forEach(initPost);
    refreshNgList();

    // observe thread expand
    let threadObserver = new MutationObserver(function (records) {
        let postReplys = records.reduce((total, record) => {
            for (let node of record.addedNodes) {
                if ((node.classList) &&
                    (node.classList.contains("reply"))) {
                    total.push(node);
                }
            }
            return total;
        } , []);
        let replySize = postReplys.length;
        console.log(`Reply size change: ${replySize}`);

        postReplys.forEach(initPost);
        refreshNgList();
    });

    document.querySelectorAll(".thread").forEach(thread => {
        threadObserver.observe(thread, { childList: true });
    });

    // bind setting
    function settingOnChangeCb(key) {
        if (key === "ngWords") {
            document.querySelectorAll(".post").forEach(markPostContent);
        }
        refreshNgList();
    }
    selfSetting.on("add", settingOnChangeCb);
    selfSetting.on("remove", settingOnChangeCb);
    selfSetting.on("clear", settingOnChangeCb);
})(window);
// vim: set sw=4 ts=4 sts=4 et:
