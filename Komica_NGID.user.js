// ==UserScript==
// @name         Komica NGID
// @namespace    https://github.com/usausausausak
// @include      http://*.komica.org/*/*
// @include      https://*.komica.org/*/*
// @version      1
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// ==/UserScript==
(function (window) {
    GM_addStyle(`.ngthread > .reply, .ngpost > *:not(.post-head) {
                   display: none;
                 }
                 .ngthread > div, .ngpost { opacity: 0.3; }`);

    let ngIds = GM_getValue("ngIdList", "").split(/\n/)
        .map(v => v.replace(/^ID:/g, "")).filter(v => v.length);
    let ngNos = GM_getValue("ngNoList", "").split(/\n/)
        .map(v => v.replace(/^No./g, "")).filter(v => v.length);

    function doNgPost(post) {
        if (post.classList.contains("threadpost")) {
            post.parentElement.classList.add("ngthread");
        }
        post.classList.add("ngpost");
    }

    function removeNgPost(post) {
        if (post.classList.contains("threadpost")) {
            post.parentElement.classList.remove("ngthread");
        }
        post.classList.remove("ngpost");
    }

    function doNgList() {
        for (let post of document.querySelectorAll(".post")) {
            let idSpan = post.querySelector(".post-head .id") ||
                post.querySelector(".post-head .now");

            let postNo = post.dataset.no;
            let postId = idSpan.dataset.id ||
                idSpan.innerHTML.replace(/^.*ID:/, "");

            if (ngIds.includes(postId)) {
                console.log(`NGID ${postId}`);
                doNgPost(post);
            } else if (ngNos.includes(postNo)) {
                console.log(`NGNO ${postNo}`);
                doNgPost(post);
            } else if (post.classList.contains("ngpost")) {
                removeNgPost(post);
            }
        }
    }

    doNgList();

    // add NG button
    function addNgIdCb(ev) {
        let id = this.dataset.id;
        if (!ngIds.includes(id)) {
            console.log(`add NGID ${id}`);
            ngIds.push(id);
            saveSetting();
        }
    }

    function addNgNoCb(ev) {
        let isNgPost = this.parentElement.parentElement
            .classList.contains("ngpost");
        let no = this.dataset.no;
        if (isNgPost) {
            ngNos = ngNos.filter(v => v !== no);
            saveSetting();
        } else if (!ngNos.includes(no)) {
            console.log(`add NGNO ${no}`);
            ngNos.push(no);
            saveSetting();
        }
    }

    for (let post of document.querySelectorAll(".post")) {
        let idSpan = post.querySelector(".post-head .id") ||
            post.querySelector(".post-head .now");
        let delButton = post.querySelector(".post-head .-del-button");

        let postNo = post.dataset.no;
        let postId = idSpan.dataset.id ||
            idSpan.innerHTML.replace(/^.*ID:/, "");

        let ngIdButton = document.createElement("span");
        ngIdButton.className = "text-button";
        ngIdButton.dataset.id = postId;
        ngIdButton.title = `NG this id: ${postId}`;
        ngIdButton.innerHTML = "NGID";
        ngIdButton.addEventListener("click", addNgIdCb, false);

        let ngNoButton = document.createElement("span");
        ngNoButton.className = "text-button";
        ngNoButton.dataset.no = postNo;
        ngNoButton.title = `NG this post: No.${postNo}`;
        ngNoButton.innerHTML = "NG";
        ngNoButton.addEventListener("click", addNgNoCb, false);

        let parent = delButton.parentElement;
        parent.insertBefore(ngNoButton, delButton);
        parent.insertBefore(ngIdButton, idSpan.nextSibling);
    }

    // add setting block
    let ngSettingIdInput = document.createElement("textarea");
    ngSettingIdInput.style.height = "10em";

    let ngSettingNoInput = document.createElement("textarea");
    ngSettingNoInput.style.height = "10em";

    function updateSetting() {
        ngSettingIdInput.value = ngIds.map(v => `ID:${v}`).join("\n");
        ngSettingNoInput.value = ngNos.map(v => `No.${v}`).join("\n");
    }

    function saveSettingCb(ev) {
        ngIds = ngSettingIdInput.value.split(/\n/)
            .map(v => v.replace(/^ID:/g, "")).filter(v => v.length);
        ngNos = ngSettingNoInput.value.split(/\n/)
            .map(v => v.replace(/^No./g, "")).filter(v => v.length);
        saveSetting();
    }

    function saveSetting() {
        GM_setValue("ngIdList", ngIds.filter(v => v.length)
            .map(v => `ID:${v}`).join("\n"));
        GM_setValue("ngNoList", ngNos.filter(v => v.length)
            .map(v => `No.${v}`).join("\n"));
        updateSetting();
        doNgList();
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
