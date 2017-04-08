// ==UserScript==
// @name         Komica NGID
// @description  NG id and post on komica
// @namespace    https://github.com/usausausausak
// @include      http://*.komica.org/*/*
// @include      https://*.komica.org/*/*
// @version      1.4.1
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// ==/UserScript==
(function (window) {
    let selfId = "[Komica_NGID]";
    let selfSetting = (function () {
        let tablePrefix = (function (loc) {
            let boardName = loc.pathname.split(/\//).slice(0, -1).join("/");
            return loc.host + boardName;
        })(document.location);

        let fallbackList = {
            ngIds: [ "ngIdList", list => list.map(v => v.replace(/^ID:/g, ""))],
            ngNos: [ "ngNoList", list => list.map(v => v.replace(/^No./g, ""))],
            ngWords: [ "ngWordList", list => list ]
        };

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
                // fallback will remove in future
                console.warn(selfId, `table "${tableName}" not found, use fallback.`);

                let [fbName, mapper] = fallbackList[key];
                let list = mapper(GM_getValue(fbName, "").split(/\n/));
                lists[key] = list.filter(v => v.length)
                    .map(v => { return { value: v }; });
            }
            console.info(selfId, `${key} have ${lists[key].length} items.`);
        }

        function addNg(key, value) {
            if (!Array.isArray(lists[key])) {
                throw new Error("Invalid key");
            } else if (lists[key].some(v => value === v.value)) {
                return false;
            }

            lists[key].push({ value: value, creationTime: new Date() });
            return true;
        }

        function removeNg(key, value) {
            if (!Array.isArray(lists[key])) {
                throw new Error("Invalid key");
            }
            lists[key] = lists[key].filter(v => v.value !== value);
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
        }

        function saveNg(key) {
            if (!Array.isArray(lists[key])) {
                throw new Error("Invalid key");
            }

            let tableName = `${tablePrefix}/${key}`;
            try {
                let jsonStr = JSON.stringify(lists[key]);
                GM_setValue(tableName, jsonStr);
            } catch (ex) {
                console.error(selfId, ex);
            }
        }

        return {
            get ngIds() { return lists.ngIds.map(v => v.value); },
            get ngNos() { return lists.ngNos.map(v => v.value); },
            get ngWords() { return lists.ngWords.map(v => v.value); },
            addNg: addNg,
            removeNg: removeNg,
            clearNg: clearNg,
            saveNg: saveNg,
            save() { Object.keys(lists).forEach(saveNg); }
        };
    })();

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
            saveSetting();
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
        saveSetting();
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

    // add setting block
    let ngSettingIdInput = document.createElement("textarea");
    ngSettingIdInput.style.height = "10em";

    let ngSettingNoInput = document.createElement("textarea");
    ngSettingNoInput.style.height = "10em";

    let ngSettingWordInput = document.createElement("textarea");
    ngSettingWordInput.style.height = "10em";

    function updateSetting() {
        ngSettingIdInput.value = selfSetting.ngIds
            .map(v => `ID:${v}`).join("\n");
        ngSettingNoInput.value = selfSetting.ngNos
            .map(v => `No.${v}`).join("\n");
        ngSettingWordInput.value = selfSetting.ngWords.join("\n");
    }

    function saveSettingCb(ev) {
        // TODO: don't update creation time
        selfSetting.clearNg("ngIds");
        selfSetting.clearNg("ngNos");
        selfSetting.clearNg("ngWords");

        let saveList = {
            ngIds: [ ngSettingIdInput, v => v.replace(/^ID:/g, "")],
            ngNos: [ ngSettingNoInput, v => v.replace(/^No./g, "")],
            ngWords: [ ngSettingWordInput, v => v ]
        };

        for (let key of Object.keys(saveList)) {
            let [field, mapper] = saveList[key];
            let inputs = field.value.split(/\n/);
            for (let input of inputs) {
                input = mapper(input);
                if (input.length > 0) {
                    selfSetting.addNg(key, input);
                }
            }
        }

        saveSetting();
    }

    function saveSetting() {
        selfSetting.save();
        updateSetting();

        // remark posts contains ng word
        document.querySelectorAll(".post").forEach(markPostContent);

        refreshNgList();
    }

    let ngSettingSave = document.createElement("button");
    ngSettingSave.style.marginTop = "5px";
    ngSettingSave.innerHTML = "Save";
    ngSettingSave.addEventListener("click", saveSettingCb, false);

    let ngSettingBlock = document.createElement("div");
    ngSettingBlock.style = `position: absolute; right: 0px;
                            display: none; flex-direction: column;
                            width: 20em;  padding: 5px;
                            background-color:rgba(0, 0, 0, 0.2);`;
    ngSettingBlock.appendChild(document.createTextNode("NGID:(id per line)"));
    ngSettingBlock.appendChild(ngSettingIdInput);
    ngSettingBlock.appendChild(document.createTextNode("NGNO:(no per line)"));
    ngSettingBlock.appendChild(ngSettingNoInput);
    ngSettingBlock.appendChild(document.createTextNode("NGWord:(word per line)"));
    ngSettingBlock.appendChild(ngSettingWordInput);
    ngSettingBlock.appendChild(ngSettingSave);

    function switchSettingCb(ev) {
        let isShow = ngSettingBlock.style.display === "none";
        ngSettingBlock.style.display = isShow ? "flex" : "none";
        updateSetting();
    }

    let ngSetting = document.createElement("a");
    ngSetting.className = "text-button";
    ngSetting.innerHTML = "NGID";
    ngSetting.addEventListener("click", switchSettingCb, false);

    let toplink = document.querySelector("#toplink");
    toplink.appendChild(document.createTextNode(" ["));
    toplink.appendChild(ngSetting);
    toplink.appendChild(document.createTextNode("]"));

    toplink.parentElement.insertBefore(ngSettingBlock, toplink.nextSibling);
})(window);
// vim: set sw=4 ts=4 sts=4 et:
