// ==UserScript==
// @name         Komica colorize id
// @namespace    https://github.com/usausausausak
// @description  Colorize user's ID in Komica
// @include      http://*.komica.org/*/*
// @include      https://*.komica.org/*/*
// @include      http://*.komica2.net/*/*
// @include      https://*.komica2.net/*/*
// @version      0.2
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

    const idViewObserver = new MutationObserver(function (records) {
        for (let record of records) {
            // DON'T modify innerHTML which will emit observer event.
            // Assume only text node.
            for (let node of record.addedNodes) {
                node.nodeValue = idTextGetExt(node.nodeValue);
            }
        }
    });

    function doColorizeId(idView) {
        idView.innerHTML = idTextGetExt(idView.textContent);

        // Id view will get restored when thread expanding.
        // Komica notify will reinsert id view,
        // so need to observe each time when element is appear.
        idViewObserver.observe(idView, { childList: true });

        // create new id view if necessary
        let colorizeIdView = idView.previousSibling;
        if (colorizeIdView.classList.contains("colorize-id-idview")) {
            return;
        }

        const postId = idView.dataset.id;
        const idColor = getIdColor(postId);

        colorizeIdView = document.createElement("span");
        colorizeIdView.classList.add("colorize-id-idview");

        const idEl = document.createElement("span");
        idEl.style.cssText = `color: ${idColor};`;
        idEl.innerHTML = postId;

        colorizeIdView.appendChild(document.createTextNode("ID:"));
        colorizeIdView.appendChild(idEl);

        idView.parentElement.insertBefore(colorizeIdView, idView);
    }

    const postHeadViewObserver = new MutationObserver(function (records) {
        for (let record of records) {
            record.addedNodes.forEach(node => {
                if (node.classList.contains("id")) {
                    doColorizeId(node);
                }
            });
        }
    });

    function colorizeId(postView) {
        const idView = postView.querySelector(".post-head .id");
        if (idView) {
            doColorizeId(idView);
        } else {
            // observe id view appearing
            const views = postView.getElementsByClassName("post-head");
            if (views.length > 0) {
                postHeadViewObserver.observe(views[0], { childList: true });
            }
        }
    }

    Array.prototype.forEach.call(document.getElementsByClassName("post"),
        colorizeId);

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

