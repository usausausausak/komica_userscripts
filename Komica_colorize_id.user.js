// ==UserScript==
// @name         Komica colorize id
// @namespace    https://github.com/usausausausak
// @description  Colorize user's ID in Komica
// @include      http://*.komica.org/*/*
// @include      https://*.komica.org/*/*
// @include      http://*.komica2.net/*/*
// @include      https://*.komica2.net/*/*
// @version      0.1
// @grant        GM_addStyle
// ==/UserScript==
(function (window) {
    "use strict";

    GM_addStyle(`
.colorize-id-idview span, span.id {
    margin: unset;
}

/* workaround for unreadable color */
.colorize-id-idview span:hover {
    color: #DD0000 !important;
}
    `);

    function idTextGetExt(idText) {
        if (idText.startsWith("ID:")) {
            return idText.substr(3 + 8); // "ID:" + 8 digit id
        } else {
            // maybe just ext is remained
            return idText;
        }
    }

    const idViewObserver = new MutationObserver(function (records) {
        for (let record of records) {
            const idView = record.target;
            // DON'T modify innerHTML which will emit observer event
            idView.firstChild.nodeValue =
                idTextGetExt(idView.firstChild.nodeValue);
        }
    });

    // from https://greasyfork.org/en/scripts/8444-komica-uiharu-package
    function getIdColor(id) {
        const r = (id.charCodeAt(0) * 57 +
                   id.charCodeAt(1) * 25 +
                   id.charCodeAt(2) * 54) % 256;
        const g = (id.charCodeAt(3) * 853 +
                   id.charCodeAt(4) * 45) % 256;
        const b = (id.charCodeAt(5) * 83 +
                   id.charCodeAt(6) * 91 +
                   id.charCodeAt(7) * 77) % 256;
        return `rgb(${r}, ${g}, ${b})`;
    }

    function colorizeId(postView) {
        const idView = postView.querySelector(".post-head .id");

        const postId = idView.dataset.id;

        const idText = idView.textContent;
        const idExt = idTextGetExt(idText);
        const idColor = getIdColor(postId);

        idView.innerHTML = idExt;

        const colorizeIdView = document.createElement("span");
        colorizeIdView.classList.add("colorize-id-idview");

        const idEl = document.createElement("span");
        idEl.style.cssText = `color: ${idColor};`;
        idEl.innerHTML = postId;

        colorizeIdView.appendChild(document.createTextNode("ID:"));
        colorizeIdView.appendChild(idEl);

        idView.parentElement.insertBefore(colorizeIdView, idView);

        // id view will get restore when thread expanding,
        idViewObserver.observe(idView, { childList: true });
    }

    let retryTime = 5;
    function start() {
        const posts = document.getElementsByClassName("post");
        // make sure script.js has ran
        if ((posts.length > 0) && (retryTime > 0)) {
            const idView = posts[0].querySelector(".post-head .id");
            if (!idView) {
                --retryTime;
                setTimeout(start, 50);
                return;
            }
        }

        Array.prototype.forEach.call(posts, colorizeId);
    }

    start();

    // observe thread expand
    const threadObserver = new MutationObserver(function (records) {
        let postReplys = records.reduce((total, record) => {
            for (let node of record.addedNodes) {
                if ((node.classList) &&
                    (node.classList.contains("reply"))) {
                    total.push(node);
                }
            }
            return total;
        } , []);
        postReplys.forEach(colorizeId);
    });

    document.querySelectorAll(".thread").forEach(thread => {
        threadObserver.observe(thread, { childList: true });
    });
})(window);

