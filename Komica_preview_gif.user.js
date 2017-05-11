// ==UserScript==
// @name         Komica preview gif
// @namespace    https://github.com/usausausausak
// @description  Play gif files inplace on komica
// @include      http://*.komica.org/*/*
// @include      https://*.komica.org/*/*
// @include      http://*.komica2.net/*/*
// @include      https://*.komica2.net/*/*
// @version      0.2
// @grant        none
// ==/UserScript==
(function (window) {
    function playGif(post) {
        let img = post.querySelector("img");
        if (!img) {
            return;
        }

        let p = img.parentNode;
        if ((p) && (p.nodeName == "A") && (p.href.match(/\.gif$/))) {
            img.src = p.href;
        }
    }

    document.querySelectorAll(".post").forEach(playGif);

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
        console.log(`[Komica_preview_gif] Reply size change: ${replySize}`);

        postReplys.forEach(playGif);
    });

    document.querySelectorAll(".thread").forEach(thread => {
        threadObserver.observe(thread, { childList: true });
    });
})(window);

